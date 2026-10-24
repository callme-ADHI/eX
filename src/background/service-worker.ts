/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  eX Security Extension
 *  Copyright (c) eX. All rights reserved.
 *  
 *  Brand: eX
 *  Product: eX
 *  Website: https://github.com/callme-ADHI/eX
 *  
 *  This software contains proprietary designs and cyber intelligence engines
 *  developed by eX. Unauthorized copying, modification, or distribution
 *  of this file, via any medium, is strictly prohibited.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { storageGet, storageSet, KEYS } from '../shared/storage';
import { DEFAULT_AI_TOOLS, DEFAULT_DOCK_ITEMS, DEFAULT_SETTINGS } from '../shared/defaults';
import { initFocusEngine, startSession, pauseSession, resumeSession, cancelSession } from './focusEngine';
import { initTabEngine, updateTabMeta } from './tabEngine';
import { initSecurityEngine, generateReport } from './securityEngine';
import { initProductivityEngine, addTask, updateTask, deleteTask } from './productivityEngine';
import { initializeTabIntelligence } from './modules/tabIntelligence';
import type { Message, MessageResponse } from '../shared/messaging';
import { extractOrigin } from '../shared/utils';
import { initAIClient } from './ai/nvidiaClient';
import { handleSettingsGet, handleSettingsSet, handleKeySet, handleKeyClear } from './ai/settings';
import { handleModelsList } from './ai/models';
import { captureVisibleTab, handleOcrWarm, handleOcrRun } from './snip/capture';
import { registerEditorFill } from './autofill/editorFill';
import { registerJsonRequest } from './ai/jsonRequest';
import { loadSettings } from './ai/settings';
import { callModel, callModelJSON } from './router';
import { getSettings, patchSettings, getTodayUsage } from './state';
import { initFaceAuthEngine, verifyFace } from './faceAuthEngine';
import { processSiteScan, processMailBatch, processMailDeep, runActiveScanForTab, getSiteVerdictForTab, getFindingsForTab, getMailSummaryForTab, getSiteAssessmentForTab } from './orchestrator';

// ─── Service Worker Entry Point ───────────────────────────────────────────────

if (chrome.storage?.session?.setAccessLevel) {
  chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' }).catch(() => {});
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    // Seed defaults on first install
    await storageSet(KEYS.AI_TOOLS, DEFAULT_AI_TOOLS);
    await storageSet(KEYS.DOCK_ITEMS, DEFAULT_DOCK_ITEMS);
    await storageSet(KEYS.SETTINGS, DEFAULT_SETTINGS);
    await storageSet(KEYS.FOCUS_SESSIONS, []);
    await storageSet(KEYS.TASKS, []);
    console.log('[eX] First install — defaults seeded.');
  }
});

// ─── Engine initialisation ────────────────────────────────────────────────────

initTabEngine();
initFaceAuthEngine();

// Security engine is active for cyber posture
initSecurityEngine();
initAIClient();

// Register Autofill editor fill in MAIN world
registerEditorFill(async () => {
  const s = await loadSettings();
  return s.autofillAllow ?? [];
});

// Register Autofill JSON proposals request handler
registerJsonRequest();

// ─── Message router ───────────────────────────────────────────────────────────
// IMPORTANT: handlers that respond asynchronously must return true.

chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse: (r: MessageResponse) => void) => {
    if (sender.id && sender.id !== chrome.runtime.id) {
      sendResponse({ ok: false, error: 'Unauthorized sender ID' });
      return false;
    }
    if ((message as any)?.type?.startsWith?.('AUTOFILL_') || (message as any)?.type === 'AI_JSON_REQUEST') {
      return; // Handled by dedicated autofill/AI listeners
    }
    handleMessage(message, sender)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // keep channel open for async response
  }
);

async function handleMessage(msg: any, sender: chrome.runtime.MessageSender): Promise<unknown> {
  switch (msg.type) {
    case 'PAGE_META': {
      const tabId = sender.tab?.id;
      if (tabId && msg.type === 'PAGE_META') {
        updateTabMeta(tabId, msg);
      }
      if (msg.type === 'PAGE_META' && msg.origin && msg.permissions) {
        const cache = (await storageGet<Record<string, any>>(KEYS.SECURITY_CACHE)) ?? {};
        if (cache[msg.origin]) {
          cache[msg.origin].permissions = msg.permissions;
          await storageSet(KEYS.SECURITY_CACHE, cache);
        }
      }
      return;
    }

    case 'OPEN_TAB':
      await chrome.tabs.create({ url: msg.url, active: msg.active ?? true });
      return;

    case 'START_FOCUS_SESSION':
      return startSession(msg.session);

    case 'PAUSE_FOCUS_SESSION':
      await pauseSession(msg.id);
      return;

    case 'RESUME_FOCUS_SESSION':
      await resumeSession(msg.id);
      return;

    case 'CANCEL_FOCUS_SESSION':
      await cancelSession(msg.id);
      return;

    case 'CLOSE_TABS':
      await Promise.all(msg.tabIds.map((id: number) => chrome.tabs.remove(id)));
      return;

    case 'REQUEST_SECURITY_REPORT': {
      const cache = (await storageGet<Record<string, unknown>>(KEYS.SECURITY_CACHE)) ?? {};
      if (cache[msg.origin]) return cache[msg.origin];
      const report = await generateReport(msg.origin, msg.origin);
      const updated = { ...cache, [msg.origin]: report };
      await storageSet(KEYS.SECURITY_CACHE, updated);
      return report;
    }

    case 'QUERY_PAGE_PERMISSIONS': {
      const tabId = sender.tab?.id;
      if (tabId) {
        return new Promise((resolve) => {
          chrome.tabs.sendMessage(tabId, { type: 'QUERY_PAGE_PERMISSIONS' }, (res) => {
            resolve(res || { permissions: {} });
          });
        });
      }
      return { permissions: {} };
    }

    case 'QUERY_ACTIVE_MEDIA': {
      const tabId = sender.tab?.id;
      if (tabId) {
        return new Promise((resolve) => {
          chrome.tabs.sendMessage(tabId, { type: 'QUERY_ACTIVE_MEDIA' }, (res) => {
            resolve(res || { cameraActive: false, micActive: false });
          });
        });
      }
      return { cameraActive: false, micActive: false };
    }

    case 'ADD_TASK':
      return addTask(msg.task);

    case 'UPDATE_TASK':
      await updateTask(msg.id, msg.updates as never);
      return;

    case 'DELETE_TASK':
      await deleteTask(msg.id);
      return;

    case 'AI_SETTINGS_GET':
      return handleSettingsGet();

    case 'AI_SETTINGS_SET':
      return handleSettingsSet(msg.settings);

    case 'AI_KEY_SET':
      return handleKeySet(msg.key);

    case 'AI_KEY_CLEAR':
      return handleKeyClear();

    case 'AI_MODELS_LIST':
      return handleModelsList(msg.refresh);

    case 'SNIP_CAPTURE':
      return captureVisibleTab(sender.tab?.windowId);

    case 'OCR_WARM':
      return handleOcrWarm();

    case 'OCR_RUN':
      return handleOcrRun(msg.dataUrl, msg.mode, msg.psmHint);

    case 'ROUTER_CALL_MODEL':
      return callModel((msg as any).task, (msg as any).messages);

    case 'ROUTER_CALL_MODEL_JSON':
      return callModelJSON((msg as any).task, (msg as any).messages, (msg as any).schemaName);

    case 'GET_SETTINGS':
      return getSettings();

    case 'PATCH_SETTINGS':
      return patchSettings((msg as any).patch);

    case 'GET_TODAY_USAGE':
      return getTodayUsage();

    case 'FACE_AUTH_VERIFY':
      return verifyFace((msg as any).imageData);
    case 'SITE_SCAN':
      return processSiteScan((msg as any).payload, sender.tab?.id);

    case 'MAIL_BATCH':
      return processMailBatch((msg as any).payload, sender.tab?.id);

    case 'MAIL_DEEP':
      return processMailDeep((msg as any).payload, sender.tab?.id);

    case 'RUN_ACTIVE_VULN_SCAN':
      return runActiveScanForTab((msg as any).origin, sender.tab?.id);

    case 'GET_SITE_VERDICT':
      return getSiteVerdictForTab((msg as any).tabId || sender.tab?.id);

    case 'GET_FINDINGS':
      return getFindingsForTab((msg as any).tabId || sender.tab?.id);

    case 'GET_MAIL_SUMMARY':
      return getMailSummaryForTab((msg as any).tabId || sender.tab?.id);

    case 'GET_SITE_ASSESSMENT':
      return getSiteAssessmentForTab((msg as any).tabId || sender.tab?.id);

    case 'TRUST_SITE': {
      const hostname = (msg as any).hostname;
      const cur = await getSettings();
      const list = new Set(cur.trustedHostnames || []);
      list.add(hostname);
      return patchSettings({ trustedHostnames: Array.from(list) });
    }

    case 'CLEAR_DATA': {
      await chrome.storage.local.remove(['history', 'cache']);
      return { ok: true };
    }


    default:
      throw new Error(`Unknown message type: ${(msg as any).type}`);
  }
}

// ─── Keyboard Commands Listener ───────────────────────────────────────────────
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-wheel') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_HUD' }).catch(() => {
        // Ignore error if content script is not loaded
      });
    }
  }

  if (command === 'start-snip') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'START_SNIP' }).catch(() => {
        // Ignore error if content script is not loaded
      });
    }
  }
});

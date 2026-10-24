import { storageGet, storageSet, storageSubscribe, KEYS } from '../shared/storage';
import type { FocusSession, AppSettings } from '../shared/types';

// ─── Focus Engine ─────────────────────────────────────────────────────────────
// Session state machine: idle → active → paused → completed/cancelled
// Runs entirely via chrome.alarms to survive tab closures.

const ALARM_NAME = 'ex1:focus:tick';
const DNR_RULE_ID_BASE = 1000;

export async function initFocusEngine() {
  // Restore alarm if session was active before SW was killed
  const session = await storageGet<FocusSession>(KEYS.CURRENT_SESSION);
  if (session && session.status === 'active') {
    await ensureAlarm(session);
  }

  // Handle alarm fires
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== ALARM_NAME) return;
    const current = await storageGet<FocusSession>(KEYS.CURRENT_SESSION);
    if (!current || current.status !== 'active') {
      chrome.alarms.clear(ALARM_NAME);
      return;
    }

    const elapsed = Date.now() - current.startedAt;
    const durationMs = current.durationMinutes * 60 * 1000;
    if (elapsed >= durationMs) {
      await completeSession(current);
    }
  });
}

export async function startSession(
  data: Omit<FocusSession, 'id' | 'startedAt' | 'status' | 'distractionAttempts'>
): Promise<FocusSession> {
  const existing = await storageGet<FocusSession>(KEYS.CURRENT_SESSION);
  if (existing && (existing.status === 'active' || existing.status === 'paused')) {
    await cancelSession(existing.id);
  }

  const session: FocusSession = {
    id: `sess_${Date.now()}`,
    goal: data.goal,
    category: data.category,
    durationMinutes: data.durationMinutes,
    startedAt: Date.now(),
    endedAt: null,
    status: 'active',
    distractionAttempts: 0,
  };

  await storageSet(KEYS.CURRENT_SESSION, session);
  await appendToHistory(session);
  await ensureAlarm(session);
  await applyDNRRules();

  return session;
}

export async function pauseSession(id: string): Promise<void> {
  const session = await storageGet<FocusSession>(KEYS.CURRENT_SESSION);
  if (!session || session.id !== id || session.status !== 'active') return;
  const updated: FocusSession = { ...session, status: 'paused' };
  await storageSet(KEYS.CURRENT_SESSION, updated);
  await updateHistory(updated);
  chrome.alarms.clear(ALARM_NAME);
}

export async function resumeSession(id: string): Promise<void> {
  const session = await storageGet<FocusSession>(KEYS.CURRENT_SESSION);
  if (!session || session.id !== id || session.status !== 'paused') return;
  // Extend startedAt to account for time paused — simpler than tracking pause duration
  const updated: FocusSession = {
    ...session,
    status: 'active',
    startedAt: Date.now() - 30000, // assume at least 30s elapsed for continuity
  };
  await storageSet(KEYS.CURRENT_SESSION, updated);
  await updateHistory(updated);
  await ensureAlarm(updated);
}

export async function cancelSession(id: string): Promise<void> {
  const session = await storageGet<FocusSession>(KEYS.CURRENT_SESSION);
  if (!session || session.id !== id) return;
  const updated: FocusSession = { ...session, status: 'cancelled', endedAt: Date.now() };
  await storageSet(KEYS.CURRENT_SESSION, null);
  await updateHistory(updated);
  chrome.alarms.clear(ALARM_NAME);
  await removeDNRRules();
}

export async function recordDistractionAttempt(): Promise<void> {
  const session = await storageGet<FocusSession>(KEYS.CURRENT_SESSION);
  if (!session || session.status !== 'active') return;
  const updated = { ...session, distractionAttempts: session.distractionAttempts + 1 };
  await storageSet(KEYS.CURRENT_SESSION, updated);
  await updateHistory(updated);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function completeSession(session: FocusSession) {
  const updated: FocusSession = { ...session, status: 'completed', endedAt: Date.now() };
  await storageSet(KEYS.CURRENT_SESSION, null);
  await updateHistory(updated);
  chrome.alarms.clear(ALARM_NAME);
  await removeDNRRules();
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon-128.png',
    title: 'Focus Session Complete',
    message: `"${session.goal}" — ${session.durationMinutes} min session finished.`,
  });
}

async function ensureAlarm(session: FocusSession) {
  chrome.alarms.clear(ALARM_NAME);
  const remaining = session.durationMinutes * 60 * 1000 - (Date.now() - session.startedAt);
  if (remaining > 0) {
    chrome.alarms.create(ALARM_NAME, { delayInMinutes: remaining / 60000 });
  }
}

async function applyDNRRules() {
  const settings = await storageGet<AppSettings>(KEYS.SETTINGS);
  const blocklist = settings?.focusBlocklist ?? [];
  const rules: chrome.declarativeNetRequest.Rule[] = blocklist.map((domain, i) => ({
    id: DNR_RULE_ID_BASE + i,
    priority: 1,
    action: { type: chrome.declarativeNetRequest.RuleActionType.BLOCK },
    condition: {
      urlFilter: `||${domain}^`,
      resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
    },
  }));
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: rules.map((r) => r.id),
    addRules: rules,
  });
}

async function removeDNRRules() {
  const ids = Array.from({ length: 20 }, (_, i) => DNR_RULE_ID_BASE + i);
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ids, addRules: [] });
}

async function appendToHistory(session: FocusSession) {
  const history = (await storageGet<FocusSession[]>(KEYS.FOCUS_SESSIONS)) ?? [];
  history.push(session);
  await storageSet(KEYS.FOCUS_SESSIONS, history);
}

async function updateHistory(session: FocusSession) {
  const history = (await storageGet<FocusSession[]>(KEYS.FOCUS_SESSIONS)) ?? [];
  const idx = history.findIndex((s) => s.id === session.id);
  if (idx >= 0) history[idx] = session;
  else history.push(session);
  await storageSet(KEYS.FOCUS_SESSIONS, history);
}

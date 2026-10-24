
/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  eX Content Script
 *  Brand: eX
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import SidePanel from './SidePanel/SidePanel';
import LockOverlay from './LockOverlay/LockOverlay';
import { extractPageFeatures } from './page-features';
import { startGmailObserver } from './gmail/gmail-scanner';
import { initClickGuard } from './click-guard';

// ─── Content Script ──────────────────────────────────────────────────────────
// Key design principles:
//  1. Randomised host id per page load — not discoverable by pattern.
//  2. CLOSED shadow root — page scripts cannot read or tamper with panel content.
//  3. Module-scope reference to shadow root (never read via host.shadowRoot).
//  4. Guard against double-injection using a property on window in isolated world.
//  5. pointer-events:none on host when CLOSED; only EdgeTrigger opts in.

// Guard property — isolated content-script world, not visible to pages
const INJECTION_GUARD = '__ex_injected__';

function isSystemPage() {
  try {
    const href = window.location.href;
    return (
      href.startsWith('chrome://') ||
      href.startsWith('chrome-extension://') ||
      href.startsWith('about:') ||
      href.startsWith('devtools:') ||
      href.startsWith('edge://')
    );
  } catch {
    return true;
  }
}

// Single source of truth for panel width — Phase 2 uses 420px
const DEFAULT_PANEL_WIDTH = 420;

// Module-level refs so they survive across self-heal calls
let hostEl: HTMLDivElement | null = null;
let shadowRootRef: ShadowRoot | null = null;

// Inlined styles placeholder replaced at build time by inlineContentCssPlugin
const INLINED_STYLES = '__EXAI_INLINED_STYLES__';

function setStyles(el: HTMLElement, styles: Record<string, string>) {
  for (const [k, v] of Object.entries(styles)) el.style.setProperty(k, v, 'important');
}

function applyHostClosedStyles(el: HTMLElement) {
  setStyles(el, { position: 'fixed', top: '0', bottom: '0', right: '0', left: 'auto', width: '0px', 'z-index': '2147483647', 'pointer-events': 'none', background: 'transparent', overflow: 'visible' });
}

function applyHostOpenStyles(el: HTMLElement, width: number) {
  setStyles(el, { position: 'fixed', top: '0', bottom: '0', right: '0', left: 'auto', width: `${width}px`, 'z-index': '2147483647', 'pointer-events': 'auto', background: 'transparent', overflow: 'visible' });
}

function applyHostSnipStyles(el: HTMLElement) {
  setStyles(el, { position: 'fixed', top: '0', bottom: '0', left: '0', right: '0', width: '100vw', height: '100vh', 'z-index': '2147483647', 'pointer-events': 'auto', background: 'transparent', overflow: 'hidden' });
}

const LOCK_ROOT_ID = 'ex-lock-overlay-root';
const lockStyles = '*{box-sizing:border-box;} body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}';

async function initLockOverlay(): Promise<void> {
  if (isSystemPage()) return;
  if (document.getElementById(LOCK_ROOT_ID)) return;

  const hostname = window.location.hostname.replace(/^www\./, '');
  if (!hostname) return;

  try {
    const res = await chrome.storage.local.get(['settings', 'facelock:privateSites']);
    const settings = (res?.settings || {}) as any;
    const directSites: string[] = (res?.['facelock:privateSites'] as string[]) || [];
    const settingsSites: string[] = settings?.faceLock?.gatedSites || [];
    const gatedSites = Array.from(new Set([...directSites, ...settingsSites]));
    if (!gatedSites.includes(hostname)) return;

    const unlockMinutes = Number(settings?.faceLock?.unlockMinutes) || 15;
    const sessionRes = await chrome.storage.session.get('unlocked:' + hostname);
    const unlockedAt = Number(sessionRes?.['unlocked:' + hostname]);
    if (unlockedAt && Date.now() - unlockedAt < unlockMinutes * 60 * 1000) {
      return;
    }

    const parent = document.body || document.documentElement;
    if (!parent) return;

    const container = document.createElement('div');
    container.id = LOCK_ROOT_ID;
    Object.assign(container.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      pointerEvents: 'auto',
    });
    parent.appendChild(container);

    const shadow = container.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = lockStyles;
    shadow.appendChild(style);

    const mountPoint = document.createElement('div');
    mountPoint.style.height = '100%';
    shadow.appendChild(mountPoint);

    const root = createRoot(mountPoint);
    root.render(
      <React.StrictMode>
        <LockOverlay
          hostname={hostname}
          onUnlock={() => {
            root.unmount();
            container.remove();
          }}
        />
      </React.StrictMode>
    );
  } catch (err) {
    console.warn('[eX] LockOverlay init error:', err);
  }
}

function init() {
  if (isSystemPage()) return;

  // Mount LockOverlay if site is gated
  initLockOverlay();

  // Guard against double-injection (isolated world property)
  if ((window as any)[INJECTION_GUARD]) return;
  (window as any)[INJECTION_GUARD] = true;

  const parent = document.body || document.documentElement;
  if (!parent) {
    setTimeout(init, 100);
    return;
  }

  // ── Create host container with randomised id ────────────────────────────
  const randomSuffix = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  const hostId = `ex-${randomSuffix}`;

  const container = document.createElement('div');
  container.id = hostId;
  hostEl = container;

  // Closed when created — panel will update width when opened
  applyHostClosedStyles(container);

  // ── Inject into DOM ──────────────────────────────────────────────────────
  const inject = () => {
    if (!hostEl) return;
    const p = document.body || document.documentElement;
    if (!p) return;
    if (p === document.body && hostEl.parentElement === document.documentElement) {
      try { document.documentElement.removeChild(hostEl); } catch { /* ignore */ }
    }
    if (!p.contains(hostEl)) {
      p.appendChild(hostEl);
    }
  };

  inject();

  // ── CLOSED Shadow DOM ────────────────────────────────────────────────────
  // mode:'closed' means host.shadowRoot === null in page scripts.
  // We keep the reference in shadowRootRef at module scope.
  const shadowRoot = container.attachShadow({ mode: 'closed' });
  shadowRootRef = shadowRoot;

  // 1. Constructable Stylesheet: CSP-immune on all Chromium platforms
  if (typeof CSSStyleSheet !== 'undefined' && shadowRoot.adoptedStyleSheets) {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(INLINED_STYLES);
      shadowRoot.adoptedStyleSheets = [sheet];
    } catch {
      // Fallback to inline <style> below
    }
  }

  // 2. Inline <style> tag: immediately applied even if page blocks <link>
  const inlineStyle = document.createElement('style');
  inlineStyle.textContent = `:host { all: initial; }\n${INLINED_STYLES}`;
  shadowRoot.appendChild(inlineStyle);

  // 3. Fallback <link> tags (for environments that allow web accessible resources)
  const tokensLink = document.createElement('link');
  tokensLink.rel = 'stylesheet';
  tokensLink.href = chrome.runtime.getURL('newtab.css');
  shadowRoot.appendChild(tokensLink);

  const stylesLink = document.createElement('link');
  stylesLink.rel = 'stylesheet';
  stylesLink.href = chrome.runtime.getURL('content.css');
  shadowRoot.appendChild(stylesLink);

  const mountPoint = document.createElement('div');
  mountPoint.style.height = '100%';
  shadowRoot.appendChild(mountPoint);

  // ── Mount React ──────────────────────────────────────────────────────────
  const reactRoot = createRoot(mountPoint);
  reactRoot.render(
    <React.StrictMode>
      <SidePanel
        container={container}
        shadowRoot={shadowRoot}
        defaultWidth={DEFAULT_PANEL_WIDTH}
        applyOpenStyles={applyHostOpenStyles}
        applyClosedStyles={applyHostClosedStyles}
        applySnipStyles={applyHostSnipStyles}
      />
    </React.StrictMode>
  );

  // ── Self-healing: restore if an SPA destroys our container ───────────────
  const domObserver = new MutationObserver(() => inject());
  domObserver.observe(document.documentElement, { childList: true, subtree: false });

  const bodyObserver = new MutationObserver(() => inject());
  if (document.body) {
    bodyObserver.observe(document.body, { childList: true, subtree: false });
  }

  function initCyberScanners() {
    if (isSystemPage()) return;
    setTimeout(() => {
      try {
        const features = extractPageFeatures();
        chrome.runtime.sendMessage({ type: 'SITE_SCAN', payload: { url: window.location.href, features } }).catch(() => {});
      } catch (_) {}
    }, 1000);
    if (window.location.hostname === 'mail.google.com') {
      startGmailObserver(
        (rows) => { chrome.runtime.sendMessage({ type: 'MAIL_BATCH', payload: { rows } }).catch(() => {}); },
        (mail) => { chrome.runtime.sendMessage({ type: 'MAIL_DEEP', payload: { mail } }).catch(() => {}); }
      );
    }
  }

  // ── Page metadata tracking ───────────────────────────────────────────────
  startTracker();
  initCyberScanners();
  initClickGuard();
}

function showAdRedirectBanner(incidentCount: number) {
  if (document.getElementById('ex-ad-redirect-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'ex-ad-redirect-banner';
  banner.style.cssText = `
    position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
    background: #1e0a0a; border: 1px solid #ff3b30; color: #fff;
    padding: 10px 16px; border-radius: 8px; z-index: 2147483640;
    box-shadow: 0 4px 20px rgba(0,0,0,0.6); display: flex; align-items: center; gap: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px;
  `;
  banner.innerHTML = `
    <span style="font-size:16px;">⚠️</span>
    <span><strong>Click-Hijack Warning:</strong> This site opens ads or redirects when you click (${incidentCount} detected).</span>
    <button id="ex-block-popups-btn" style="background:#ff3b30;color:#fff;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;font-weight:600;font-size:11px;">Block Pop-ups</button>
    <button id="ex-dismiss-banner-btn" style="background:transparent;border:none;color:#aaa;cursor:pointer;font-size:14px;padding:2px 6px;">✕</button>
  `;
  (document.body || document.documentElement).appendChild(banner);
  document.getElementById('ex-block-popups-btn')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'BLOCK_SITE_POPUPS', hostname: window.location.hostname });
    banner.remove();
  });
  document.getElementById('ex-dismiss-banner-btn')?.addEventListener('click', () => {
    banner.remove();
  });
}

// ─── API Usage and Metadata Reporting ────────────────────────────────────────

let cameraAccessCount = 0;
let micAccessCount = 0;
let fetchCount = 0;

function startTracker() {
  if (!window.location.protocol.startsWith('http')) return;

  // Note: 'ex:api_access' events originate from tracker.ts running in MAIN world.
  // This is an existing design — we leave it unchanged (eX doesn't add new
  // window-level events; all new messaging goes through chrome.runtime).
  window.addEventListener('ex:api_access', (e: any) => {
    const detail = e.detail;
    if (detail) {
      cameraAccessCount = detail.cameraCount;
      micAccessCount    = detail.micCount;
      fetchCount        = detail.fetchCount;
      sendPageMeta();
    }
  });

  sendPageMeta();

  const titleEl = document.querySelector('title');
  if (titleEl) {
    const obs = new MutationObserver(() => sendPageMeta());
    obs.observe(titleEl, { subtree: true, childList: true, characterData: true });
  }
}

async function getPagePermissions(): Promise<Record<string, string>> {
  const perms = ['camera', 'microphone', 'geolocation', 'notifications'];
  const result: Record<string, string> = {
    camera: 'unknown', microphone: 'unknown',
    geolocation: 'unknown', notifications: 'unknown',
    clipboard: 'unknown', popups: 'unknown',
  };

  for (const name of perms) {
    try {
      const status = await navigator.permissions.query({ name: name as any });
      result[name] = status.state;
      status.onchange = () => sendPageMeta();
    } catch { /* ignore */ }
  }
  return result;
}

async function sendPageMeta() {
  const title   = document.title || '';
  const descEl  = document.querySelector('meta[name="description"]') ||
                  document.querySelector('meta[property="og:description"]');
  const description = descEl?.getAttribute('content') || '';
  const ogTypeEl    = document.querySelector('meta[property="og:type"]');
  const ogType      = ogTypeEl?.getAttribute('content') || '';
  const perms       = await getPagePermissions();

  chrome.runtime.sendMessage({
    type: 'PAGE_META',
    origin: window.location.origin,
    title, description, ogType,
    cameraAccessCount, micAccessCount, fetchCount,
    permissions: perms,
  }).catch(() => { /* service worker may not be ready yet */ });
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
init();

// ─── Message listeners ────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'QUERY_PAGE_PERMISSIONS') {
    const names = ['camera', 'microphone', 'geolocation', 'notifications', 'clipboard-read'];
    Promise.allSettled(
      names.map(name =>
        navigator.permissions.query({ name: name as any }).then(s => ({ name, state: s.state }))
      )
    ).then(results => {
      const permissions: Record<string, string> = {};
      results.forEach((r, i) => {
        permissions[names[i]] = r.status === 'fulfilled' ? r.value.state : 'unavailable';
      });
      sendResponse({ permissions });
    });
    return true;
  }

  if (msg.type === 'QUERY_ACTIVE_MEDIA') {
    navigator.mediaDevices?.enumerateDevices?.()
      .then(devices => {
        sendResponse({
          cameraActive: devices.some(d => d.kind === 'videoinput' && d.label !== ''),
          micActive:    devices.some(d => d.kind === 'audioinput' && d.label !== ''),
        });
      })
      .catch(() => {
        sendResponse({ cameraActive: false, micActive: false });
      });
    return true;
  }

  if (msg.type === 'SHOW_CLICK_HIJACK_BANNER') {
    showAdRedirectBanner(msg.incidentCount || 1);
    return;
  }
});

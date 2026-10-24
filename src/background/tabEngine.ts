import { storageGet, storageSet, KEYS } from '../shared/storage';
import type { TabRecord, TabSnapshot } from '../shared/types';
import { extractDomain, classifyDomain, classifyTab, isProductive, isDistracting } from '../shared/utils';
import { computeAllRollups } from './productivityEngine';

// ─── In-memory tab store ──────────────────────────────────────────────────────

const tabStore = new Map<number, TabRecord>();
let activeTabId: number | null = null;
let activeTabStart: number = Date.now();

// sessionRestoreMap stores URL -> previous state mapping
const sessionRestoreMap = new Map<string, {
  openedAt: number;
  activeDurationMs: number;
  visitCount: number;
  category: string;
  description?: string;
  ogType?: string;
  cameraAccessCount?: number;
  micAccessCount?: number;
  fetchCount?: number;
}>();

// Helper to look up URL or retrieve new tab defaults
function getRestoredOrNew(tabId: number, url: string, title: string, existing?: TabRecord): TabRecord {
  const now = Date.now();
  const domain = extractDomain(url);

  if (existing) {
    return {
      ...existing,
      url,
      domain,
      title: title || existing.title,
    };
  }

  const restored = sessionRestoreMap.get(url);
  if (restored) {
    return {
      tabId,
      url,
      domain,
      title,
      openedAt: restored.openedAt,
      lastAccessedAt: now,
      activeDurationMs: restored.activeDurationMs,
      visitCount: restored.visitCount,
      category: restored.category,
      description: restored.description,
      ogType: restored.ogType,
      cameraAccessCount: restored.cameraAccessCount,
      micAccessCount: restored.micAccessCount,
      fetchCount: restored.fetchCount
    };
  }

  return {
    tabId,
    url,
    domain,
    title,
    openedAt: now,
    lastAccessedAt: now,
    activeDurationMs: 0,
    visitCount: 1,
    category: classifyTab(url, domain, title, '', ''),
  };
}

export function initTabEngine() {
  // Pre-load last snapshot from storage to restore openedAt dates
  storageGet<TabSnapshot>(KEYS.TAB_SNAPSHOT).then((lastSnap) => {
    if (lastSnap && lastSnap.tabs) {
      for (const t of lastSnap.tabs) {
        if (t.url && t.url !== 'chrome://newtab/' && t.url !== 'about:blank') {
          sessionRestoreMap.set(t.url, {
            openedAt: t.openedAt,
            activeDurationMs: t.activeDurationMs,
            visitCount: t.visitCount,
            category: t.category,
            description: t.description,
            ogType: t.ogType,
            cameraAccessCount: t.cameraAccessCount,
            micAccessCount: t.micAccessCount,
            fetchCount: t.fetchCount
          });
        }
      }
    }

    // Now query all active tabs
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (!tab.id) continue;
        const url = tab.url ?? '';
        const title = tab.title ?? '';
        tabStore.set(tab.id, getRestoredOrNew(tab.id, url, title));
      }
      publishSnapshot();
    });
  }).catch((err) => {
    console.error('[tabEngine] failed to load snapshot for session restore:', err);
    // Fallback: load tabs normally
    chrome.tabs.query({}, (tabs) => {
      const now = Date.now();
      for (const tab of tabs) {
        if (!tab.id) continue;
        const url = tab.url ?? '';
        const domain = extractDomain(url);
        tabStore.set(tab.id, {
          tabId: tab.id,
          url,
          domain,
          title: tab.title ?? '',
          openedAt: now,
          lastAccessedAt: now,
          activeDurationMs: 0,
          visitCount: 1,
          category: classifyTab(url, domain, tab.title ?? '', '', ''),
        });
      }
      publishSnapshot();
    });
  });

  // Tab lifecycle events
  chrome.tabs.onCreated.addListener((tab) => {
    if (!tab.id) return;
    const url = tab.url ?? '';
    const title = tab.title ?? '';
    tabStore.set(tab.id, getRestoredOrNew(tab.id, url, title));
    publishSnapshot();
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.title) {
      const existing = tabStore.get(tabId);
      const url = tab.url ?? existing?.url ?? '';
      const title = tab.title ?? existing?.title ?? '';
      const description = existing?.description ?? '';
      const ogType = existing?.ogType ?? '';
      
      const updated = getRestoredOrNew(tabId, url, title, existing);
      updated.category = classifyTab(url, updated.domain, title, description, ogType);
      if (changeInfo.url) {
        updated.visitCount = (existing?.visitCount ?? 0) + 1;
      }
      updated.lastAccessedAt = Date.now();

      tabStore.set(tabId, updated);
      publishSnapshot();
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === activeTabId) flushActiveTime();
    tabStore.delete(tabId);
    publishSnapshot();
  });

  chrome.tabs.onActivated.addListener(({ tabId }) => {
    flushActiveTime();
    activeTabId = tabId;
    activeTabStart = Date.now();
    const record = tabStore.get(tabId);
    if (record) {
      tabStore.set(tabId, { ...record, lastAccessedAt: Date.now() });
    }
  });

  // Publish snapshot every 60s for dashboard freshness
  setInterval(() => {
    flushActiveTime();
    publishSnapshot();
  }, 60_000);
}

// ─── Snapshot computation ─────────────────────────────────────────────────────

function publishSnapshot() {
  const tabs = Array.from(tabStore.values());
  const byCategory: Record<string, number> = {};
  const domainCount: Record<string, { visitCount: number; activeDurationMs: number }> = {};

  for (const t of tabs) {
    byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
    if (!domainCount[t.domain]) domainCount[t.domain] = { visitCount: 0, activeDurationMs: 0 };
    domainCount[t.domain].visitCount += t.visitCount;
    domainCount[t.domain].activeDurationMs += t.activeDurationMs;
  }

  // Duplicate detection
  const urlGroups: Record<string, number[]> = {};
  for (const t of tabs) {
    if (!urlGroups[t.url]) urlGroups[t.url] = [];
    urlGroups[t.url].push(t.tabId);
  }
  const duplicates = Object.entries(urlGroups)
    .filter(([, ids]) => ids.length > 1)
    .map(([url, tabIds]) => ({ url, tabIds }));

  const topDomains = Object.entries(domainCount)
    .map(([domain, stats]) => ({ domain, ...stats }))
    .sort((a, b) => b.visitCount - a.visitCount)
    .slice(0, 10);

  const snapshot: TabSnapshot = {
    tabs,
    duplicates,
    totalTabs: tabs.length,
    byCategory,
    topDomains,
    snapshotAt: Date.now(),
  };

  storageSet(KEYS.TAB_SNAPSHOT, snapshot).then(() => {
    computeAllRollups().catch(err => console.error('[tabEngine] computeAllRollups error:', err));
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function flushActiveTime() {
  if (activeTabId === null) return;
  const record = tabStore.get(activeTabId);
  if (record) {
    const elapsed = Date.now() - activeTabStart;
    if (elapsed > 0) {
      tabStore.set(activeTabId, {
        ...record,
        activeDurationMs: record.activeDurationMs + elapsed,
      });
      logProductivityTime(record.category, elapsed);
    }
  }
  activeTabStart = Date.now();
}

export function updateTabMeta(tabId: number, meta: {
  title: string;
  description: string;
  ogType: string;
  cameraAccessCount: number;
  micAccessCount: number;
  fetchCount: number;
}) {
  const existing = tabStore.get(tabId);
  if (existing) {
    const category = classifyTab(existing.url, existing.domain, meta.title, meta.description, meta.ogType);
    tabStore.set(tabId, {
      ...existing,
      title: meta.title || existing.title,
      description: meta.description,
      ogType: meta.ogType,
      cameraAccessCount: meta.cameraAccessCount,
      micAccessCount: meta.micAccessCount,
      fetchCount: meta.fetchCount,
      category,
    });
    publishSnapshot();
  }
}

export { tabStore };

async function logProductivityTime(category: string, durationMs: number) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const history = (await storageGet<Record<string, { productiveMs: number; neutralMs: number; distractingMs: number }>>('ex1:productivity_history')) ?? {};
    if (!history[today]) {
      history[today] = { productiveMs: 0, neutralMs: 0, distractingMs: 0 };
    }
    if (isProductive(category)) {
      history[today].productiveMs += durationMs;
    } else if (isDistracting(category)) {
      history[today].distractingMs += durationMs;
    } else {
      history[today].neutralMs += durationMs;
    }
    const dates = Object.keys(history).sort();
    if (dates.length > 14) {
      for (const d of dates.slice(0, dates.length - 14)) {
        delete history[d];
      }
    }
    await storageSet('ex1:productivity_history', history);
  } catch (err) {
    console.error('[tabEngine] failed to log productivity time:', err);
  }
}

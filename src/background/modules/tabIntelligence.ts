import type { TabEntry, WeeklyTabAnalysis } from '../../shared/types';

const TAB_LOG_KEY = 'tabs:weeklog';
const WEEK_ANALYSIS_KEY = 'tabs:weekanalysis';

// In-memory active tab tracker storing metadata to support tab closures and title/url tracking
const activeTabInfo: Record<number, { startTime: number; url: string; title: string }> = {};

export function initializeTabIntelligence() {
  chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    const now = Date.now();
    
    // Close out all other active tab sessions in memory
    for (const [id, info] of Object.entries(activeTabInfo)) {
      const numericId = Number(id);
      if (numericId !== tabId) {
        await recordTabSession(numericId, info.startTime, now, info.url, info.title);
        delete activeTabInfo[numericId];
      }
    }

    // Initialize tracking for the newly activated tab
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (tab && tab.url) {
      activeTabInfo[tabId] = {
        startTime: now,
        url: tab.url,
        title: tab.title ?? '',
      };
    }
  });

  chrome.tabs.onRemoved.addListener(async (tabId) => {
    const existing = activeTabInfo[tabId];
    if (existing) {
      await recordTabSession(tabId, existing.startTime, Date.now(), existing.url, existing.title);
      delete activeTabInfo[tabId];
    }
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // If the URL or title changes and is complete, close out current session and begin a new one
    if (changeInfo.status === 'complete' && tab.url) {
      const now = Date.now();
      const existing = activeTabInfo[tabId];
      if (existing) {
        recordTabSession(tabId, existing.startTime, now, existing.url, existing.title);
      }
      activeTabInfo[tabId] = {
        startTime: now,
        url: tab.url,
        title: tab.title ?? '',
      };
    }
  });

  // Track currently active tabs across all windows immediately on load
  chrome.tabs.query({ active: true }, (tabs) => {
    const now = Date.now();
    for (const tab of tabs) {
      if (tab.id && tab.url) {
        activeTabInfo[tab.id] = {
          startTime: now,
          url: tab.url,
          title: tab.title ?? '',
        };
      }
    }
  });

  // Recalculate on startup
  chrome.runtime.onStartup.addListener(async () => {
    await runWeeklyAnalysisRecalculation();
  });

  // Re-run hourly via chrome.alarms
  chrome.alarms.create('tabIntelHourly', { periodInMinutes: 60 });
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'tabIntelHourly') {
      await runWeeklyAnalysisRecalculation();
    }
  });

  // Perform initial calculation on first load
  runWeeklyAnalysisRecalculation();
}

async function recordTabSession(tabId: number, startTime: number, endTime: number, url: string, title: string) {
  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return;

  let domain = '';
  try {
    domain = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return;
  }
  const durationMs = endTime - startTime;
  if (durationMs < 3000) return; // ignore flickers under 3 seconds

  const entry: TabEntry = {
    domain,
    url,
    title,
    startTime,
    endTime,
    durationMs,
    category: classifyDomain(domain),
    date: new Date(startTime).toISOString().split('T')[0], // YYYY-MM-DD
  };

  // Append to log, keeping only the last 7 days
  const stored = await chrome.storage.local.get(TAB_LOG_KEY);
  const log: TabEntry[] = (stored[TAB_LOG_KEY] as TabEntry[]) ?? [];
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const trimmed = log.filter(e => e.startTime > cutoff);
  trimmed.push(entry);
  await chrome.storage.local.set({ [TAB_LOG_KEY]: trimmed });

  // Update analysis on session record to keep dashboard hot-updating
  await runWeeklyAnalysisRecalculation();
}

const CATEGORY_MAP: Record<string, string> = {
  // Development
  'github.com': 'Development', 'stackoverflow.com': 'Development',
  'developer.mozilla.org': 'Development', 'docs.python.org': 'Development',
  'npmjs.com': 'Development', 'vercel.com': 'Development',

  // Education
  'ktu.edu.in': 'Education', 'mits.etlab.app': 'Education',
  'coursera.org': 'Education', 'udemy.com': 'Education',
  'khanacademy.org': 'Education', 'hackerrank.com': 'Education',
  'leetcode.com': 'Education',

  // AI
  'chat.openai.com': 'AI', 'claude.ai': 'AI', 'gemini.google.com': 'AI',
  'grok.x.ai': 'AI', 'deepseek.com': 'AI',

  // Social
  'instagram.com': 'Social', 'twitter.com': 'Social', 'x.com': 'Social',
  'facebook.com': 'Social', 'reddit.com': 'Social', 'linkedin.com': 'Social',

  // Entertainment
  'youtube.com': 'Entertainment', 'netflix.com': 'Entertainment',
  'spotify.com': 'Entertainment', 'twitch.tv': 'Entertainment',

  // Productivity
  'gmail.com': 'Productivity', 'calendar.google.com': 'Productivity',
  'notion.so': 'Productivity', 'drive.google.com': 'Productivity',
};

function classifyDomain(domain: string): string {
  if (CATEGORY_MAP[domain]) return CATEGORY_MAP[domain];
  // Partial match for subdomains
  for (const [key, category] of Object.entries(CATEGORY_MAP)) {
    if (domain.endsWith(key)) return category;
  }
  return 'Other';
}

export async function runWeeklyAnalysisRecalculation() {
  const analysis = await computeWeeklyAnalysis();
  await chrome.storage.local.set({ [WEEK_ANALYSIS_KEY]: analysis });
}

async function computeWeeklyAnalysis(): Promise<WeeklyTabAnalysis> {
  const stored = await chrome.storage.local.get(TAB_LOG_KEY);
  const log: TabEntry[] = (stored[TAB_LOG_KEY] as TabEntry[]) ?? [];
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const week = log.filter(e => e.startTime > cutoff);

  // Total time per domain
  const domainTime: Record<string, number> = {};
  const domainVisits: Record<string, number> = {};
  const categoryTime: Record<string, number> = {};
  const dailyTime: Record<string, number> = {}; // keyed by YYYY-MM-DD

  for (const entry of week) {
    domainTime[entry.domain] = (domainTime[entry.domain] ?? 0) + entry.durationMs;
    domainVisits[entry.domain] = (domainVisits[entry.domain] ?? 0) + 1;
    categoryTime[entry.category] = (categoryTime[entry.category] ?? 0) + entry.durationMs;
    dailyTime[entry.date] = (dailyTime[entry.date] ?? 0) + entry.durationMs;
  }

  // Top 10 domains by time
  const topDomains = Object.entries(domainTime)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, ms]) => ({
      domain,
      visits: domainVisits[domain],
      durationMs: ms,
      durationFormatted: formatDuration(ms),
      category: classifyDomain(domain),
    }));

  // Most productive day
  const mostProductiveDay = Object.entries(dailyTime)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Productive vs distracting split
  const productiveCategories = ['Development', 'Education', 'AI', 'Productivity'];
  const distractingCategories = ['Social', 'Entertainment'];

  const productiveMs = Object.entries(categoryTime)
    .filter(([cat]) => productiveCategories.includes(cat))
    .reduce((sum, [, ms]) => sum + ms, 0);
  const distractingMs = Object.entries(categoryTime)
    .filter(([cat]) => distractingCategories.includes(cat))
    .reduce((sum, [, ms]) => sum + ms, 0);
  const totalMs = Object.values(domainTime).reduce((a, b) => a + b, 0) || 1; // avoid divide by zero

  const categoryBreakdown = Object.entries(categoryTime)
    .sort((a, b) => b[1] - a[1])
    .map(([category, ms]) => ({
      category,
      durationMs: ms,
      durationFormatted: formatDuration(ms),
      percentage: Math.round((ms / totalMs) * 100),
    }));

  return {
    generatedAt: Date.now(),
    totalDomains: Object.keys(domainTime).length,
    totalSessionTime: formatDuration(totalMs === 1 ? 0 : totalMs),
    topDomains,
    categoryBreakdown,
    dailyActivity: dailyTime,
    mostProductiveDay,
    productiveMs,
    distractingMs,
    productiveFormatted: formatDuration(productiveMs),
    distractingFormatted: formatDuration(distractingMs),
  };
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

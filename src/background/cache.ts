const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 2000;

interface CacheEntry {
  verdict: any;
  ts: number;
}

export async function cacheGet(key: string): Promise<any | null> {
  try {
    const storeKey = `cache:${key}`;
    const result = await chrome.storage.local.get(storeKey);
    const entry = result[storeKey] as CacheEntry | undefined;
    if (!entry) return null;
    if (Date.now() - entry.ts > TTL_MS) {
      chrome.storage.local.remove(storeKey).catch(() => {});
      return null;
    }
    return entry.verdict;
  } catch (_) {
    return null;
  }
}

export async function cacheSet(key: string, verdict: any): Promise<void> {
  try {
    const storeKey = `cache:${key}`;
    const entry: CacheEntry = { verdict, ts: Date.now() };
    await chrome.storage.local.set({ [storeKey]: entry });
    await evictOldest();
  } catch (_) {}
}

async function evictOldest(): Promise<void> {
  try {
    const all = await chrome.storage.local.get(null);
    const entries: { k: string; ts: number }[] = Object.entries(all)
      .filter(([k]) => k.startsWith('cache:'))
      .map(([k, v]: [string, any]) => ({ k, ts: v?.ts || 0 }));
    if (entries.length <= MAX_ENTRIES) return;
    entries.sort((a, b) => a.ts - b.ts);
    const toRemove = entries.slice(0, entries.length - MAX_ENTRIES).map((e) => e.k);
    await chrome.storage.local.remove(toRemove);
  } catch (_) {}
}

export function siteCacheKey(hostname: string, featuresSignature: string): string {
  return `site:${hostname}:${featuresSignature}`;
}

export function mailCacheKey(rowId: string): string {
  return `mail:${rowId}`;
}

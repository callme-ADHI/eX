/**
 * Verdict cache backed by chrome.storage.local.
 * TTL: 24 hours. Max: 2000 entries (evict oldest).
 */

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 2000;

/**
 * Get a cached verdict.
 * @param {string} key
 * @returns {Promise<any|null>}
 */
export async function cacheGet(key) {
  try {
    const storeKey = `cache:${key}`;
    const result = await chrome.storage.local.get(storeKey);
    const entry = result[storeKey];
    if (!entry) return null;
    if (Date.now() - entry.ts > TTL_MS) {
      chrome.storage.local.remove(storeKey).catch(() => {});
      return null;
    }
    return entry.verdict;
  } catch (_) { return null; }
}

/**
 * Store a verdict in cache.
 * @param {string} key
 * @param {any} verdict
 */
export async function cacheSet(key, verdict) {
  try {
    const storeKey = `cache:${key}`;
    await chrome.storage.local.set({ [storeKey]: { verdict, ts: Date.now() } });
    await evictOldest();
  } catch (_) {}
}

async function evictOldest() {
  try {
    const all = await chrome.storage.local.get(null);
    const entries = Object.entries(all)
      .filter(([k]) => k.startsWith('cache:'))
      .map(([k, v]) => ({ k, ts: v.ts || 0 }));
    if (entries.length <= MAX_ENTRIES) return;
    entries.sort((a, b) => a.ts - b.ts);
    const toRemove = entries.slice(0, entries.length - MAX_ENTRIES).map((e) => e.k);
    await chrome.storage.local.remove(toRemove);
  } catch (_) {}
}

/**
 * Build a cache key for a site scan.
 * @param {string} hostname
 * @param {string} featuresSignature
 * @returns {string}
 */
export function siteCacheKey(hostname, featuresSignature) {
  return `site:${hostname}:${featuresSignature}`;
}

/**
 * Build a cache key for a mail row.
 * @param {string} rowId
 * @returns {string}
 */
export function mailCacheKey(rowId) {
  return `mail:${rowId}`;
}

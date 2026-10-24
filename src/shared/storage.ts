// ─── Storage keys ─────────────────────────────────────────────────────────────

export const KEYS = {
  AI_TOOLS:          'config:aiTools',
  DOCK_ITEMS:        'config:dockItems',
  SETTINGS:          'config:settings',
  FOCUS_SESSIONS:    'focus:sessions',
  CURRENT_SESSION:   'focus:current',
  TASKS:             'productivity:tasks',
  ROLLUP_DAILY:      'productivity:rollup:daily',
  ROLLUP_WEEKLY:     'productivity:rollup:weekly',
  ROLLUP_MONTHLY:    'productivity:rollup:monthly',
  TAB_SNAPSHOT:      'tabs:snapshot',
  SECURITY_CACHE:    'security:reports',   // object keyed by origin
  WEEK_ANALYSIS:     'tabs:weekanalysis',
} as const;

const isExtension = typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;

// ─── Generic get / set ────────────────────────────────────────────────────────

export async function storageGet<T>(key: string): Promise<T | undefined> {
  if (isExtension) {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result[key] as T | undefined);
      });
    });
  } else {
    const val = localStorage.getItem(key);
    if (val === null) return undefined;
    try {
      return JSON.parse(val) as T;
    } catch {
      return val as unknown as T;
    }
  }
}

export async function storageSet(key: string, value: unknown): Promise<void> {
  if (isExtension) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  } else {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('ex1:storage', { detail: { key, newValue: value } }));
  }
}

export async function storageGetAll<T extends Record<string, unknown>>(
  keys: string[]
): Promise<Partial<T>> {
  if (isExtension) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => resolve(result as Partial<T>));
    });
  } else {
    const result: Partial<T> = {};
    for (const key of keys) {
      const val = localStorage.getItem(key);
      if (val !== null) {
        try {
          result[key as keyof T] = JSON.parse(val);
        } catch {
          result[key as keyof T] = val as any;
        }
      }
    }
    return result;
  }
}

export async function storageRemove(key: string): Promise<void> {
  if (isExtension) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, resolve);
    });
  } else {
    localStorage.removeItem(key);
    window.dispatchEvent(new CustomEvent('ex1:storage', { detail: { key, newValue: null } }));
  }
}

/** Subscribe to a specific key change. Returns an unsubscribe function. */
export function storageSubscribe<T>(
  key: string,
  callback: (newValue: T, oldValue: T | undefined) => void
): () => void {
  if (isExtension) {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === 'local' && key in changes) {
        callback(changes[key].newValue as T, changes[key].oldValue as T | undefined);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  } else {
    const listener = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.key === key) {
        callback(detail.newValue as T, undefined);
      }
    };
    window.addEventListener('ex1:storage', listener);
    return () => window.removeEventListener('ex1:storage', listener);
  }
}

/** Subscribe to any of several keys. Callback receives the changed key + new value. */
export function storageSubscribeAny(
  keys: string[],
  callback: (key: string, newValue: unknown) => void
): () => void {
  if (isExtension) {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area !== 'local') return;
      for (const key of keys) {
        if (key in changes) callback(key, changes[key].newValue);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  } else {
    const listener = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && keys.includes(detail.key)) {
        callback(detail.key, detail.newValue);
      }
    };
    window.addEventListener('ex1:storage', listener);
    return () => window.removeEventListener('ex1:storage', listener);
  }
}

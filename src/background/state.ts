/**
 * Global session state and settings accessors.
 */
import { KEYS } from "./keys";

export interface SettingsShape {
  apiKeys: Record<string, string>;
  cloudEnabled: boolean;
  scanSites: boolean;
  scanGmail: boolean;
  faceLock: {
    enabled: boolean;
    gatedSites: string[];
    pinHash: string;
    pinSalt: string;
    threshold: number;
    unlockMinutes: number;
  };
  trustedHostnames: string[];
}

const DEFAULT_SETTINGS: SettingsShape = {
  apiKeys: { KEY_1: "", KEY_2: "", KEY_3: "" },
  cloudEnabled: true,
  scanSites: true,
  scanGmail: true,
  faceLock: {
    enabled: false,
    gatedSites: [],
    pinHash: "",
    pinSalt: "",
    threshold: 0.5,
    unlockMinutes: 15,
  },
  trustedHostnames: [],
};

export async function getSettings(): Promise<SettingsShape> {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const result = await chrome.storage.local.get("settings");
      const stored = (result.settings || {}) as Partial<SettingsShape>;
      return deepMerge(DEFAULT_SETTINGS, stored);
    }
  } catch (_) {}
  return { ...DEFAULT_SETTINGS };
}

export async function patchSettings(patch: Partial<SettingsShape>): Promise<SettingsShape> {
  const current = await getSettings();
  const updated = deepMerge(current, patch);
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await chrome.storage.local.set({ settings: updated });
    }
  } catch (_) {}
  return updated;
}

function deepMerge(a: any, b: any): any {
  const out = { ...a };
  for (const key of Object.keys(b)) {
    if (b[key] && typeof b[key] === "object" && !Array.isArray(b[key]) &&
        a[key] && typeof a[key] === "object" && !Array.isArray(a[key])) {
      out[key] = deepMerge(a[key], b[key]);
    } else {
      out[key] = b[key];
    }
  }
  return out;
}

export async function setTabState(tabId: number, key: string, value: any): Promise<void> {
  const sessionKey = "tab:" + tabId + ":" + key;
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.session) {
      await chrome.storage.session.set({ [sessionKey]: value });
    }
  } catch (_) {}
}

export async function getTabState(tabId: number, key: string): Promise<any> {
  const sessionKey = "tab:" + tabId + ":" + key;
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.session) {
      const result = await chrome.storage.session.get(sessionKey);
      return result[sessionKey] ?? null;
    }
  } catch (_) {}
  return null;
}

export async function clearTabState(tabId: number): Promise<void> {
  const keys = ["tab:" + tabId + ":siteVerdict", "tab:" + tabId + ":findings", "tab:" + tabId + ":mailSummary"];
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.session) {
      await chrome.storage.session.remove(keys);
    }
  } catch (_) {}
}

export async function appendHistory(entry: any): Promise<void> {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const res = await chrome.storage.local.get("history");
      const history = (res.history || []) as any[];
      history.unshift(entry);
      if (history.length > 200) history.splice(200);
      await chrome.storage.local.set({ history });
    }
  } catch (_) {}
}

export async function incrementUsage(task: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const key = "usage:" + today + ":" + task;
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const result = await chrome.storage.local.get(key);
      const val = (Number(result[key]) || 0) + 1;
      await chrome.storage.local.set({ [key]: val });
    }
  } catch (_) {}
}

export async function getTodayUsage(): Promise<Record<string, number>> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const allData = await chrome.storage.local.get(null);
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(allData)) {
        if (k.startsWith("usage:" + today + ":")) {
          out[k.replace("usage:" + today + ":", "")] = Number(v) || 0;
        }
      }
      return out;
    }
  } catch (_) {}
  return {};
}

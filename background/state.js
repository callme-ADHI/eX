/**
 * Global session state and settings accessors.
 */
import { KEYS } from "./keys.js";

const DEFAULT_SETTINGS = {
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

export async function getSettings() {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const result = await chrome.storage.local.get("settings");
      const stored = result.settings || {};
      return deepMerge(DEFAULT_SETTINGS, stored);
    }
  } catch (_) {}
  return { ...DEFAULT_SETTINGS };
}

export async function patchSettings(patch) {
  const current = await getSettings();
  const updated = deepMerge(current, patch);
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await chrome.storage.local.set({ settings: updated });
    }
  } catch (_) {}
  return updated;
}

function deepMerge(a, b) {
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

export async function setTabState(tabId, key, value) {
  const sessionKey = "tab:" + tabId + ":" + key;
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.session) {
      await chrome.storage.session.set({ [sessionKey]: value });
    }
  } catch (_) {}
}

export async function getTabState(tabId, key) {
  const sessionKey = "tab:" + tabId + ":" + key;
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.session) {
      const result = await chrome.storage.session.get(sessionKey);
      return result[sessionKey] ?? null;
    }
  } catch (_) {}
  return null;
}

export async function clearTabState(tabId) {
  const keys = ["tab:" + tabId + ":siteVerdict", "tab:" + tabId + ":findings", "tab:" + tabId + ":mailSummary"];
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.session) {
      await chrome.storage.session.remove(keys);
    }
  } catch (_) {}
}

export async function appendHistory(entry) {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const { history = [] } = await chrome.storage.local.get("history");
      history.unshift(entry);
      if (history.length > 200) history.splice(200);
      await chrome.storage.local.set({ history });
    }
  } catch (_) {}
}

export async function incrementUsage(task) {
  const today = new Date().toISOString().slice(0, 10);
  const key = "usage:" + today + ":" + task;
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const result = await chrome.storage.local.get(key);
      await chrome.storage.local.set({ [key]: (result[key] || 0) + 1 });
    }
  } catch (_) {}
}

export async function getTodayUsage() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const allData = await chrome.storage.local.get(null);
      const out = {};
      for (const [k, v] of Object.entries(allData)) {
        if (k.startsWith("usage:" + today + ":")) {
          out[k.replace("usage:" + today + ":", "")] = v;
        }
      }
      return out;
    }
  } catch (_) {}
  return {};
}

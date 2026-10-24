/**
 * Model router: routes AI tasks to the right NVIDIA NIM model.
 * All LLM calls go through the rate-limited queue.
 * SPEC Section 5.
 */

import { enqueue, withRetry } from "./queue.js";
import { getSettings, incrementUsage } from "./state.js";
import { extractJSON } from "./json-extract.js";
import { validate } from "../detectors/schemas.js";
import { redact } from "./redact.js";
import { KEYS } from "./keys.js";

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

let modelConfig = null;

async function loadConfig() {
  if (modelConfig) return modelConfig;
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
      const resp = await fetch(chrome.runtime.getURL("models.config.json"));
      modelConfig = await resp.json();
    } else {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const { fileURLToPath } = await import("node:url");
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      modelConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../models.config.json"), "utf8"));
    }
  } catch (e) {
    console.error("[eX] Failed to load models.config.json", e);
    modelConfig = {};
  }
  return modelConfig;
}

function resolveKey(keyName, apiKeys) {
  if (apiKeys && apiKeys[keyName]) return apiKeys[keyName];
  if (KEYS && KEYS[keyName]) return KEYS[keyName];
  for (const k of ["KEY_1", "KEY_2", "KEY_3"]) {
    if (apiKeys && apiKeys[k]) return apiKeys[k];
    if (KEYS && KEYS[k]) return KEYS[k];
  }
  return null;
}

export async function callModel(task, messages) {
  const settings = await getSettings();

  if (settings.cloudEnabled === false) {
    const e = new Error("Cloud disabled");
    e.code = "NO_CLOUD";
    throw e;
  }

  const config = await loadConfig();
  const taskCfg = config[task];
  if (!taskCfg) throw new Error("Unknown task: " + task);

  const key = resolveKey(taskCfg.key, settings.apiKeys);
  if (!key) {
    const e = new Error("No API key configured");
    e.code = "NO_CLOUD";
    throw e;
  }

  const redactedMessages = messages.map((m) => ({ ...m, content: redact(m.content) }));
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.session) {
      await chrome.storage.session.set({ ["lastPayload:" + task]: redactedMessages });
    }
  } catch (_) {}

  const body = {
    model: taskCfg.model,
    messages: redactedMessages,
    temperature: taskCfg.temperature,
    max_tokens: taskCfg.max_tokens,
    stream: false,
  };

  const resp = await enqueue(() =>
    withRetry((signal) =>
      fetch(NVIDIA_URL, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
      })
    )
  );

  const json = await resp.json();
  await incrementUsage(task);
  const choice = json.choices?.[0]?.message;
  return choice?.content || choice?.reasoning_content || "";
}

export async function callModelJSON(task, messages, schemaName) {
  let raw = await callModel(task, messages);
  let parsed = extractJSON(raw);
  if (parsed && validate(schemaName, parsed).ok) {
    return parsed;
  }

  // Retry ONCE with reminder
  const reminderMessages = [
    ...messages,
    { role: "assistant", content: raw },
    { role: "user", content: "Your previous response was not valid JSON matching the schema. Return ONLY valid JSON matching the schema with no extra text or markdown formatting." },
  ];
  raw = await callModel(task, reminderMessages);
  parsed = extractJSON(raw);
  const v = validate(schemaName, parsed);
  if (!parsed || !v.ok) {
    const err = new Error("JSON schema validation failed for " + schemaName + ": " + (v.errors?.join(", ") || "invalid"));
    err.code = "INVALID_JSON";
    throw err;
  }
  return parsed;
}

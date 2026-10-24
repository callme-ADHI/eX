/**
 * Pings models for tasks in models.config.json.
 * Usage: node tools/ping-model.mjs [task|all]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetArg = process.argv[2] || "all";

const keysPath = path.resolve(__dirname, "../background/keys.js");
const configPath = path.resolve(__dirname, "../models.config.json");

if (!fs.existsSync(keysPath) || !fs.existsSync(configPath)) {
  console.error("Missing background/keys.js or models.config.json");
  process.exit(1);
}

const keysContent = fs.readFileSync(keysPath, "utf8");
function getKey(name) {
  const m = keysContent.match(new RegExp(name + ":\\s*[\"'](nvapi-[^\"']+)[\"']"));
  return m ? m[1] : null;
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

async function pingTask(taskName) {
  const taskConfig = config[taskName];
  if (!taskConfig) {
    throw new Error("Unknown task: " + taskName);
  }

  const key = getKey(taskConfig.key) || getKey("KEY_1");
  const start = Date.now();

  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + key,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: taskConfig.model,
      messages: [{ role: "user", content: "Reply with the single word: pong" }],
      temperature: taskConfig.temperature,
      max_tokens: 30,
      stream: false
    })
  });

  const durationMs = Date.now() - start;

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 150)}`);
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning_content || "(empty)";
  return { task: taskName, model: taskConfig.model, key: taskConfig.key, durationMs, reply: reply.trim().slice(0, 40) };
}

async function main() {
  const tasksToRun = targetArg === "all" ? Object.keys(config) : [targetArg];
  let failed = false;

  for (const t of tasksToRun) {
    try {
      const res = await pingTask(t);
      console.log(`✓ [${res.task}] ${res.model} (${res.key}): ${res.durationMs}ms`);
    } catch (err) {
      console.error(`✗ [${t}] Failed:`, err.message);
      failed = true;
    }
  }

  if (failed) process.exit(1);
}

main();

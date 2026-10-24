/**
 * Pings a model for a task from models.config.json.
 * Usage: node tools/ping-model.mjs <task>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const task = process.argv[2] || "chat";

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
const taskConfig = config[task];
if (!taskConfig) {
  console.error("Unknown task: " + task + ". Available: " + Object.keys(config).join(", "));
  process.exit(1);
}

const key = getKey(taskConfig.key) || getKey("KEY_1");

async function ping() {
  console.log("Pinging task \"" + task + "\" with model \"" + taskConfig.model + "\" using " + taskConfig.key + "...");
  try {
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

    if (!res.ok) {
      console.error("HTTP error " + res.status + ":", (await res.text()).slice(0, 200));
      process.exit(1);
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning_content || "(empty)";
    console.log("Result:", reply.trim());
  } catch (err) {
    console.error("Request failed:", err.message);
    process.exit(1);
  }
}

ping();

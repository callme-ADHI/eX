/**
 * Lists available models from the NVIDIA NIM completions API.
 * Reads KEY_1 from background/keys.js.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const keysPath = path.resolve(__dirname, "../background/keys.js");
const content = fs.readFileSync(keysPath, "utf8");
const match = content.match(/KEY_1:\s*["'](nvapi-[^"']+)["']/);
const key = match ? match[1] : null;

if (!key) {
  console.error("Could not find KEY_1 in background/keys.js");
  process.exit(1);
}

async function list() {
  try {
    const res = await fetch("https://integrate.api.nvidia.com/v1/models", {
      headers: { Authorization: "Bearer " + key }
    });

    if (!res.ok) {
      console.error("HTTP error: " + res.status);
      process.exit(1);
    }

    const data = await res.json();
    console.log("Found " + (data.data?.length || 0) + " models:");
    for (const m of (data.data || [])) {
      console.log("- " + m.id);
    }
  } catch (err) {
    console.error("Error listing models:", err.message);
    process.exit(1);
  }
}

list();

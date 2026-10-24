/**
 * Extract the first valid JSON object or array from LLM text output.
 */

export function extractJSON(text: string): any | null {
  if (!text || typeof text !== "string") return null;

  try {
    return JSON.parse(text);
  } catch (_) {}

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch (_) {}
  }

  const objStart = text.indexOf("{");
  const arrStart = text.indexOf("[");

  let start = -1;
  let isObj = false;

  if (objStart !== -1 && arrStart !== -1) {
    if (objStart < arrStart) { start = objStart; isObj = true; }
    else { start = arrStart; isObj = false; }
  } else if (objStart !== -1) {
    start = objStart; isObj = true;
  } else if (arrStart !== -1) {
    start = arrStart; isObj = false;
  }

  if (start === -1) return null;

  const openChar = isObj ? "{" : "[";
  const closeChar = isObj ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === String.fromCharCode(34)) { inString = !inString; continue; }
    if (inString) continue;

    if (c === openChar) depth++;
    else if (c === closeChar) {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch (_) {
          return null;
        }
      }
    }
  }

  return null;
}

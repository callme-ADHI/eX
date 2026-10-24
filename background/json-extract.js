/**
 * Extract the first balanced JSON object or array from model text.
 * Handles ```json fences and leading prose.
 * Pure function - no chrome.* deps - runs in Node for tests.
 */

/**
 * Find and parse the first balanced JSON object or array in text.
 * @param {string} text
 * @returns {any|null}
 */
export function extractJSON(text) {
  if (!text || typeof text !== 'string') return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const source = fenced ? fenced[1].trim() : text;
  let startIdx = -1;
  let startChar = '';
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '{' || source[i] === '[') {
      startIdx = i; startChar = source[i]; break;
    }
  }
  if (startIdx === -1) return null;
  const endChar = startChar === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = startIdx; i < source.length; i++) {
    const ch = source[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"' && !escaped) { inString = !inString; continue; }
    if (inString) continue;
    if (ch === startChar) depth++;
    else if (ch === endChar) {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(source.slice(startIdx, i + 1)); }
        catch (_) { return null; }
      }
    }
  }
  return null;
}

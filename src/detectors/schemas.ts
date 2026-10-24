/**
 * Hand-written JSON schema validators for LLM outputs.
 */

export interface ValidationResult<T = any> {
  ok: boolean;
  value?: T;
  error?: string;
  errors?: string[];
}

function err(msg: string): ValidationResult {
  return { ok: false, error: msg, errors: [msg] };
}

function ok<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

function checkString(v: any, field: string, maxLen?: number): string | null {
  if (typeof v !== "string") return field + " must be a string";
  if (maxLen && v.length > maxLen) return field + " exceeds " + maxLen + " chars";
  return null;
}

function checkEnum(v: any, field: string, values: string[]): string | null {
  if (!values.includes(v)) return field + " must be one of " + values.join("|") + ", got \"" + v + "\"";
  return null;
}

export function validateVerdict(v: any): ValidationResult {
  if (!v || typeof v !== "object") return err("Expected object");
  const levelErr = checkEnum(v.level, "level", ["safe", "suspicious", "dangerous"]);
  if (levelErr) return err(levelErr);
  if (typeof v.confidence !== "number" || v.confidence < 0 || v.confidence > 1)
    return err("confidence must be number 0-1");
  if (!Array.isArray(v.reasons)) return err("reasons must be array");
  if (v.reasons.length > 5) return err("reasons max 5 items");
  for (const r of v.reasons) {
    const e = checkString(r, "reason item", 200);
    if (e) return err(e);
  }
  return ok(v);
}

export function validateMailBatch(v: any): ValidationResult {
  if (!Array.isArray(v)) return err("Expected array");
  for (const item of v) {
    if (!item || typeof item !== "object") return err("Item must be object");
    const e = checkString(item.id, "id", 200) || checkEnum(item.badge, "badge", ["High", "Check", "Safe"]);
    if (e) return err(e);
    if (typeof item.score !== "number" || item.score < 0 || item.score > 100)
      return err("score must be number 0-100");
    if (!Array.isArray(item.reasons) || item.reasons.length > 3)
      return err("reasons must be array max 3");
    for (const r of item.reasons) {
      const re = checkString(r, "reason", 200);
      if (re) return err(re);
    }
  }
  return ok(v);
}

export function validateMailDeep(v: any): ValidationResult {
  if (!v || typeof v !== "object") return err("Expected object");
  const levelErr = checkEnum(v.level, "level", ["safe", "suspicious", "dangerous"]);
  if (levelErr) return err(levelErr);
  if (typeof v.score !== "number" || v.score < 0 || v.score > 100)
    return err("score must be number 0-100");
  if (!Array.isArray(v.reasons) || v.reasons.length > 5)
    return err("reasons must be array max 5");
  for (const r of v.reasons) {
    const e = checkString(r, "reason", 200);
    if (e) return err(e);
  }
  const advErr = checkString(v.advice, "advice", 400);
  if (advErr) return err(advErr);
  if (!Array.isArray(v.links)) return err("links must be array");
  for (const link of v.links) {
    if (!link || typeof link !== "object") return err("Link must be object");
    const le = checkString(link.href, "href", 2000) ||
               checkString(link.text, "text", 200) ||
               (link.resolved && checkString(link.resolved, "resolved", 2000));
    if (le) return err(le);
    if (typeof link.mismatch !== "boolean") return err("link.mismatch must be boolean");
  }
  return ok(v);
}

export function validateSitePhish(v: any): ValidationResult {
  if (!v || typeof v !== "object") return err("Expected object");
  const levelErr = checkEnum(v.level, "level", ["safe", "suspicious", "dangerous"]);
  if (levelErr) return err(levelErr);
  if (typeof v.confidence !== "number" || v.confidence < 0 || v.confidence > 1)
    return err("confidence must be number 0-1");
  if (!Array.isArray(v.reasons) || v.reasons.length > 5)
    return err("reasons must be array max 5");
  for (const r of v.reasons) {
    const e = checkString(r, "reason", 200);
    if (e) return err(e);
  }
  return ok(v);
}

export function validateVulnExplain(v: any): ValidationResult {
  if (!Array.isArray(v)) return err("Expected array");
  for (const item of v) {
    if (!item || typeof item !== "object") return err("Item must be object");
    const e = checkString(item.id, "id", 200) ||
              checkString(item.explanation, "explanation", 2000) ||
              checkString(item.fix, "fix", 2000);
    if (e) return err(e);
  }
  return ok(v);
}

export const SCHEMAS: Record<string, (v: any) => ValidationResult> = {
  verdict: validateVerdict,
  mailBatch: validateMailBatch,
  mailDeep: validateMailDeep,
  sitePhish: validateSitePhish,
  vulnExplain: validateVulnExplain,
};

export function validate(name: string, value: any): ValidationResult {
  const fn = SCHEMAS[name];
  if (!fn) return err("Unknown schema: " + name);
  return fn(value);
}

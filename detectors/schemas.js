/**
 * Hand-written JSON schema validators for LLM outputs.
 * All return { ok: boolean, value?: any, error?: string }.
 * Pure functions - no external libraries, runs in Node for unit tests.
 */

/** @param {string} msg */
function err(msg) { return { ok: false, error: msg }; }
/** @param {any} value */
function ok(value) { return { ok: true, value }; }

/**
 * @param {any} v
 * @param {string} field
 * @param {number} [maxLen]
 * @returns {string|null}
 */
function checkString(v, field, maxLen) {
  if (typeof v !== 'string') return `${field} must be a string`;
  if (maxLen && v.length > maxLen) return `${field} exceeds ${maxLen} chars`;
  return null;
}

/**
 * @param {any} v
 * @param {string} field
 * @param {string[]} values
 * @returns {string|null}
 */
function checkEnum(v, field, values) {
  if (!values.includes(v)) return `${field} must be one of ${values.join('|')}, got "${v}"`;
  return null;
}

/**
 * Validate a verdict object from the LLM.
 * @param {any} v
 * @returns {{ok:boolean, value?:any, error?:string}}
 */
export function validateVerdict(v) {
  if (!v || typeof v !== 'object') return err('Expected object');
  const levelErr = checkEnum(v.level, 'level', ['safe', 'suspicious', 'dangerous']);
  if (levelErr) return err(levelErr);
  if (typeof v.confidence !== 'number' || v.confidence < 0 || v.confidence > 1)
    return err('confidence must be number 0-1');
  if (!Array.isArray(v.reasons)) return err('reasons must be array');
  if (v.reasons.length > 5) return err('reasons max 5 items');
  for (const r of v.reasons) {
    const e = checkString(r, 'reason item', 200);
    if (e) return err(e);
  }
  return ok(v);
}

/**
 * Validate mailBatch LLM output array.
 * @param {any} v
 * @returns {{ok:boolean, value?:any, error?:string}}
 */
export function validateMailBatch(v) {
  if (!Array.isArray(v)) return err('Expected array');
  for (const item of v) {
    if (!item || typeof item !== 'object') return err('Item must be object');
    const ie = checkString(item.i, 'i', 200);
    if (ie) return err(ie);
    const re = checkEnum(item.risk, 'risk', ['low', 'medium', 'high']);
    if (re) return err(re);
    const we = checkString(item.why, 'why', 200);
    if (we) return err(we);
  }
  return ok(v);
}

/**
 * Validate mailDeep LLM output.
 * @param {any} v
 * @returns {{ok:boolean, value?:any, error?:string}}
 */
export function validateMailDeep(v) {
  if (!v || typeof v !== 'object') return err('Expected object');
  const levelErr = checkEnum(v.level, 'level', ['safe', 'suspicious', 'dangerous']);
  if (levelErr) return err(levelErr);
  if (typeof v.confidence !== 'number' || v.confidence < 0 || v.confidence > 1)
    return err('confidence must be number 0-1');
  if (!Array.isArray(v.reasons) || v.reasons.length > 5)
    return err('reasons must be array max 5');
  for (const r of v.reasons) {
    const e = checkString(r, 'reason', 200);
    if (e) return err(e);
  }
  const atkTypes = ['credential_phishing','malware','invoice_scam','bec','reward_scam','other','none'];
  const atkErr = checkEnum(v.attack_type, 'attack_type', atkTypes);
  if (atkErr) return err(atkErr);
  if (v.advice !== undefined) {
    const ae = checkString(v.advice, 'advice', 300);
    if (ae) return err(ae);
  }
  return ok(v);
}

/**
 * Validate sitePhish LLM output.
 * @param {any} v
 * @returns {{ok:boolean, value?:any, error?:string}}
 */
export function validateSitePhish(v) {
  if (!v || typeof v !== 'object') return err('Expected object');
  const levelErr = checkEnum(v.level, 'level', ['safe', 'suspicious', 'dangerous']);
  if (levelErr) return err(levelErr);
  if (typeof v.confidence !== 'number' || v.confidence < 0 || v.confidence > 1)
    return err('confidence must be number 0-1');
  if (!Array.isArray(v.reasons) || v.reasons.length > 5)
    return err('reasons must be array max 5');
  for (const r of v.reasons) {
    const e = checkString(r, 'reason', 200);
    if (e) return err(e);
  }
  return ok(v);
}

/**
 * Validate vulnExplain LLM output array.
 * @param {any} v
 * @returns {{ok:boolean, value?:any, error?:string}}
 */
export function validateVulnExplain(v) {
  if (!Array.isArray(v)) return err('Expected array');
  for (const item of v) {
    if (!item || typeof item !== 'object') return err('Item must be object');
    const e = checkString(item.id, 'id', 200) ||
              checkString(item.explanation, 'explanation', 2000) ||
              checkString(item.fix, 'fix', 2000);
    if (e) return err(e);
  }
  return ok(v);
}

/** Map schema name to validator function. */
export const SCHEMAS = {
  verdict:     validateVerdict,
  mailBatch:   validateMailBatch,
  mailDeep:    validateMailDeep,
  sitePhish:   validateSitePhish,
  vulnExplain: validateVulnExplain,
};

/**
 * Validate by schema name.
 * @param {string} name
 * @param {any} value
 * @returns {{ok:boolean, value?:any, error?:string}}
 */
export function validate(name, value) {
  const fn = SCHEMAS[name];
  if (!fn) return err(`Unknown schema: ${name}`);
  return fn(value);
}

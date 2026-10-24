/**
 * PII redaction applied before any cloud API call.
 * Pure functions - no chrome.* calls - can run in Node for tests.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const CARD_RE  = /\b(?:\d[ -]?){12,18}\d\b/g;
const PHONE_RE = /(?:\+?\d[\s\-.]?){6,11}\d/g;
const TOKEN_RE = /[A-Za-z0-9_\-]{24,}/g;
const OTP_RE   = /(?:otp|code|pin)[^\d]{0,10}(\d{4,8})/gi;
const QUERY_RE = /(\?[^\s#]*)/g;

/**
 * Extract the domain part from an email address.
 * @param {string} email
 * @returns {string}
 */
export function extractDomain(email) {
  const atIdx = email.lastIndexOf('@');
  return atIdx >= 0 ? email.slice(atIdx + 1) : email;
}

/**
 * Redact PII from text before sending to cloud APIs.
 * @param {string} text
 * @param {{keepDomains?:boolean}} [opts]
 * @returns {string}
 */
export function redact(text, opts) {
  if (!opts) opts = {};
  if (!text || typeof text !== 'string') return text;
  let out = text;

  out = out.replace(OTP_RE, (match, code) => match.replace(code, '[CODE]'));

  if (opts.keepDomains) {
    out = out.replace(EMAIL_RE, (m) => `[EMAIL]@${extractDomain(m)}`);
  } else {
    out = out.replace(EMAIL_RE, '[EMAIL]');
  }

  // Credit cards (13-19 digits) before general phone regex
  out = out.replace(CARD_RE, (m) => {
    const digits = m.replace(/\D/g, '');
    return (digits.length >= 13 && digits.length <= 19) ? '[CARD]' : m;
  });

  out = out.replace(PHONE_RE, (m) => {
    const digits = m.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 12 ? '[PHONE]' : m;
  });

  out = out.replace(TOKEN_RE, '[TOKEN]');
  out = out.replace(QUERY_RE, '?[QUERY]');
  return out;
}

/**
 * Redact a structured object recursively.
 * @param {any} obj
 * @param {{keepDomains?:boolean}} [opts]
 * @returns {any}
 */
export function redactObj(obj, opts) {
  if (!obj) return obj;
  if (typeof obj === 'string') return redact(obj, opts);
  if (Array.isArray(obj)) return obj.map((item) => redactObj(item, opts));
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) { out[k] = redactObj(v, opts); }
    return out;
  }
  return obj;
}

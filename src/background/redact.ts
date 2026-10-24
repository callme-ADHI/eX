/**
 * PII redaction applied before any cloud API call.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?\d[\s\-.]?){7,15}\d/g;
const CARD_RE  = /\b(?:\d[\s\-]?){13,19}\b/g;
const TOKEN_RE = /[A-Za-z0-9_\-]{24,}/g;
const OTP_RE   = /(?:otp|code|pin)[^\d]{0,10}(\d{4,8})/gi;
const QUERY_RE = /(\?[^\s#]*)/g;

export function extractDomain(email: string): string {
  const atIdx = email.lastIndexOf("@");
  return atIdx >= 0 ? email.slice(atIdx + 1) : email;
}

export interface RedactOptions {
  keepDomains?: boolean;
}

export function redact(text: string, opts?: RedactOptions): string {
  if (!opts) opts = {};
  if (!text || typeof text !== "string") return text;
  let out = text;
  out = out.replace(OTP_RE, (match, code) => match.replace(code, "[CODE]"));
  if (opts.keepDomains) {
    out = out.replace(EMAIL_RE, (m) => "[EMAIL]@" + extractDomain(m));
  } else {
    out = out.replace(EMAIL_RE, "[EMAIL]");
  }
  out = out.replace(PHONE_RE, (m) => {
    const digits = m.replace(/\D/g, "");
    return digits.length >= 7 ? "[PHONE]" : m;
  });
  out = out.replace(CARD_RE, (m) => {
    const digits = m.replace(/\D/g, "");
    return (digits.length >= 13 && digits.length <= 19) ? "[CARD]" : m;
  });
  out = out.replace(TOKEN_RE, "[TOKEN]");
  out = out.replace(QUERY_RE, "?[QUERY]");
  return out;
}

export function redactObj(obj: any, opts?: RedactOptions): any {
  if (!obj) return obj;
  if (typeof obj === "string") return redact(obj, opts);
  if (Array.isArray(obj)) return obj.map((item) => redactObj(item, opts));
  if (typeof obj === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = redactObj(v, opts);
    }
    return out;
  }
  return obj;
}

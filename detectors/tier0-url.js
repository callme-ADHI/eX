/**
 * Tier-0 URL feature scoring.
 * Pure function — no chrome.* deps. SPEC Section 6.2.
 */

import { BRANDS, isTrustedDomain } from './topdomains.js';
import { parseDomain } from './psl.js';

const SUSPICIOUS_TLDS = new Set(['zip','mov','top','xyz','click','country','gq','tk','ml','cf','ga','work','support']);
const SHORTENERS = new Set(['bit.ly','tinyurl.com','t.co','goo.gl','is.gd','cutt.ly','rb.gy','ow.ly','buff.ly']);
const EXECUTABLE_EXTS = /\.(exe|msi|bat|cmd|scr|pif|application|gadget|hta|cpl|msc|jar|vbs|vbe|js|jse|ws|wsf|wsc|wsh|ps1|apk|dmg|pkg|iso|bin|deb|rpm|zip|rar|7z|tar|gz|bz2|xz)$/i;

/**
 * Compute Shannon entropy of a string.
 * @param {string} str
 * @returns {number}
 */
function shannonEntropy(str) {
  const freq = {};
  for (const ch of str) freq[ch] = (freq[ch] || 0) + 1;
  let entropy = 0;
  for (const count of Object.values(freq)) {
    const p = count / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Compute Levenshtein edit distance between two strings.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function editDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

/**
 * Score URL for phishing risk signals.
 * @param {string} urlStr
 * @returns {{score:number, reasons:string[]}}
 */
export function scoreSiteUrl(urlStr) {
  let score = 0;
  const reasons = [];

  let parsed;
  try { parsed = new URL(urlStr); } catch (_) { return { score: 0, reasons: [] }; }

  const hostname = parsed.hostname;
  const parsedDomain = parseDomain(hostname);
  const registrableDomain = parsedDomain.registrableDomain;
  const domainLabel = parsedDomain.label;
  const tld = parsedDomain.suffix;
  const subdomains = parsedDomain.subdomain ? parsedDomain.subdomain.split('.').filter(Boolean) : [];

  // Check for executable extension in path
  if (EXECUTABLE_EXTS.test(parsed.pathname)) {
    score += 25;
    reasons.push('Downloadable or executable file in URL path');
  }

  // Shared hosting domains (e.g. *.appspot.com, *.github.io) NEVER get whitelisted as trusted
  if (!parsedDomain.isSharedHost && isTrustedDomain(registrableDomain) && !parsed.href.includes('@')) {
    if (score === 0) return { score: 0, reasons: [] };
  }

  // IP address hostname
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.startsWith('[')) {
    score += 25; reasons.push('Hostname is an IP address (no domain)');
  }

  // Punycode
  if (hostname.includes('xn--')) {
    score += 25; reasons.push('Punycode internationalized domain (possible homograph attack)');
  }

  // @ in URL
  if (parsed.href.includes('@') && parsed.href.indexOf('@') < parsed.href.indexOf(hostname)) {
    score += 20; reasons.push('URL contains @ character before host (credential bypass trick)');
  }

  // Subdomain depth >= 4
  if (subdomains.length >= 4) {
    score += 10; reasons.push(`Excessive subdomain depth (${subdomains.length} levels)`);
  }

  // URL length > 100
  if (urlStr.length > 100) {
    score += 8; reasons.push('Unusually long URL');
  }

  // Hostname has >= 3 hyphens
  const hyphenCount = (hostname.match(/-/g) || []).length;
  if (hyphenCount >= 3) {
    score += 8; reasons.push('Many hyphens in hostname (common in phishing domains)');
  }

  // Brand in subdomain/path but registrable domain != brand's domain
  for (const brandEntry of BRANDS) {
    const subdPath = subdomains.join('.') + parsed.pathname;
    if (subdPath.toLowerCase().includes(brandEntry.brand) &&
        !brandEntry.domains.some((d) => d === registrableDomain)) {
      score += 30;
      reasons.push(`"${brandEntry.brand}" brand name in subdomain/path but domain is "${registrableDomain}"`);
      break;
    }
  }

  // Edit distance <= 2 to a brand label (not equal)
  for (const brandEntry of BRANDS) {
    const dist = editDistance(domainLabel.toLowerCase(), brandEntry.brand);
    if (dist > 0 && dist <= 2) {
      score += 30;
      reasons.push(`Domain "${domainLabel}" is very similar to brand "${brandEntry.brand}" (possible typosquatting)`);
      break;
    }
  }

  // Suspicious TLD
  if (SUSPICIOUS_TLDS.has(tld)) {
    score += 10; reasons.push(`Suspicious TLD ".${tld}" commonly used in phishing`);
  }

  // Shortener domain
  if (SHORTENERS.has(registrableDomain)) {
    score += 10; reasons.push('URL shortener — true destination hidden');
  }

  // Digits ratio in hostname > 0.3
  const digits = (hostname.match(/\d/g) || []).length;
  if (digits / hostname.length > 0.3) {
    score += 8; reasons.push('High ratio of digits in hostname');
  }

  // Shannon entropy of hostname label > 3.8
  if (shannonEntropy(domainLabel) > 3.8) {
    score += 8; reasons.push('High entropy in domain label (likely generated/obfuscated)');
  }

  // Not HTTPS and page has password input (checked at page level, flag here as a signal)
  if (parsed.protocol === 'http:') {
    score += 5; reasons.push('Non-HTTPS connection');
  }

  return { score: Math.min(100, score), reasons: reasons.slice(0, 5) };
}

import { BRANDS, isTrustedDomain } from './topdomains';

const SUSPICIOUS_TLDS = new Set(['zip','mov','top','xyz','click','country','gq','tk','ml','cf','ga','work','support']);
const SHORTENERS = new Set(['bit.ly','tinyurl.com','t.co','goo.gl','is.gd','cutt.ly','rb.gy','ow.ly','buff.ly']);

function getRegistrableDomain(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  return parts.slice(-2).join('.');
}

function shannonEntropy(str: string): number {
  const freq: Record<string, number> = {};
  for (const ch of str) freq[ch] = (freq[ch] || 0) + 1;
  let entropy = 0;
  for (const count of Object.values(freq)) {
    const p = count / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function scoreSiteUrl(urlStr: string): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  let parsed: URL;
  try { parsed = new URL(urlStr); } catch (_) { return { score: 0, reasons: [] }; }

  const hostname = parsed.hostname;
  const registrableDomain = getRegistrableDomain(hostname);
  const domainLabel = registrableDomain.split('.')[0];
  const tld = registrableDomain.split('.').slice(-1)[0];
  const subdomains = hostname.replace(`.${registrableDomain}`, '').split('.').filter(Boolean);

  if (isTrustedDomain(registrableDomain) && !parsed.href.includes('@')) {
    return { score: 0, reasons: [] };
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
    if (dist > 0 && dist <= 2 && !brandEntry.domains.includes(registrableDomain)) {
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

  return {
    score: Math.min(100, score),
    reasons: reasons.slice(0, 5)
  };
}

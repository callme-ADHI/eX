export interface Finding {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  evidence: string;
  explanation: string | null;
  fix: string | null;
  mode: 'passive' | 'active';
  url?: string;
}

export function runPassiveChecks({
  url,
  headers = {},
  cookies = [],
  features = {},
}: {
  url: string;
  headers?: Record<string, string>;
  cookies?: any[];
  features?: any;
}): Finding[] {
  const findings: Finding[] = [];
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch (_) {
    return [];
  }

  const isHttps = parsedUrl.protocol === 'https:';

  // 1. Missing Content-Security-Policy
  if (!headers['content-security-policy']) {
    findings.push({
      id: 'csp-missing',
      title: 'Missing Content-Security-Policy',
      severity: 'medium',
      category: 'headers',
      evidence: 'Content-Security-Policy header absent',
      explanation: 'CSP helps prevent Cross-Site Scripting (XSS) and data injection attacks.',
      fix: "Add a Content-Security-Policy header specifying trusted script sources, e.g., default-src 'self'.",
      mode: 'passive',
      url,
    });
  }

  // 2. Missing X-Frame-Options and no CSP frame-ancestors
  const hasCspFrameAncestors = (headers['content-security-policy'] || '').includes('frame-ancestors');
  if (!headers['x-frame-options'] && !hasCspFrameAncestors) {
    findings.push({
      id: 'clickjacking-allowed',
      title: 'Clickjacking Protection Missing',
      severity: 'medium',
      category: 'headers',
      evidence: 'Framing allowed (no X-Frame-Options or CSP frame-ancestors)',
      explanation: 'Without clickjacking protection, attackers can frame this site to hijack user clicks.',
      fix: "Set X-Frame-Options: DENY or SAMEORIGIN, or CSP frame-ancestors 'self'.",
      mode: 'passive',
      url,
    });
  }

  // 3. Missing Strict-Transport-Security on HTTPS
  if (isHttps && !headers['strict-transport-security']) {
    findings.push({
      id: 'hsts-missing',
      title: 'Missing Strict-Transport-Security (HSTS)',
      severity: 'low',
      category: 'headers',
      evidence: 'Strict-Transport-Security header absent on HTTPS origin',
      explanation: 'HSTS ensures browsers only connect via HTTPS, preventing SSL stripping attacks.',
      fix: 'Add Strict-Transport-Security: max-age=31536000; includeSubDomains',
      mode: 'passive',
      url,
    });
  }

  // 4. Missing X-Content-Type-Options: nosniff
  if ((headers['x-content-type-options'] || '').toLowerCase() !== 'nosniff') {
    findings.push({
      id: 'nosniff-missing',
      title: 'Missing X-Content-Type-Options: nosniff',
      severity: 'low',
      category: 'headers',
      evidence: headers['x-content-type-options'] || 'Header absent',
      explanation: 'Prevents browsers from MIME-sniffing a response away from the declared content-type.',
      fix: 'Set X-Content-Type-Options: nosniff',
      mode: 'passive',
      url,
    });
  }

  // 5. Server / X-Powered-By banner leakage
  const serverHeader = headers['server'] || headers['x-powered-by'];
  if (serverHeader && /\d/.test(serverHeader)) {
    findings.push({
      id: 'banner-leak',
      title: 'Server Version Disclosure',
      severity: 'info',
      category: 'headers',
      evidence: `Server banner exposes version: "${serverHeader}"`,
      explanation: 'Revealing exact software versions assists attackers in identifying known CVEs.',
      fix: 'Configure web server / framework to suppress version banners in response headers.',
      mode: 'passive',
      url,
    });
  }

  // 6. Cookie security checks (missing Secure or SameSite on cookies)
  if (Array.isArray(cookies)) {
    for (const cookie of cookies) {
      if (isHttps && !cookie.secure) {
        findings.push({
          id: `insecure-cookie-${cookie.name}`,
          title: `Insecure Cookie: ${cookie.name}`,
          severity: 'medium',
          category: 'cookies',
          evidence: `Cookie "${cookie.name}" is missing the Secure flag on HTTPS`,
          explanation: 'Non-secure cookies can be transmitted in plaintext if HTTP requests are made.',
          fix: 'Set the Secure attribute on all sensitive cookies.',
          mode: 'passive',
          url,
        });
        break;
      }
    }
  }

  return findings;
}

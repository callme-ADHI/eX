/**
 * Passive posture & security header checks.
 * SPEC Section 6.4.
 */

/**
 * Run passive posture checks against captured tab headers, cookies, and page features.
 * @param {object} params
 * @param {string} params.url
 * @param {Record<string, string>} [params.headers]
 * @param {Array<object>} [params.cookies]
 * @param {object} [params.features]
 * @returns {Array<object>} Finding[]
 */
export function runPassiveChecks({ url, headers = {}, cookies = [], features = {} }) {
  const findings = [];
  let parsedUrl;
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
      evidence: 'header absent',
      explanation: null,
      fix: null,
      mode: 'passive'
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
      evidence: 'framing allowed (no X-Frame-Options or CSP frame-ancestors)',
      explanation: null,
      fix: null,
      mode: 'passive'
    });
  }

  // 3. Missing Strict-Transport-Security on HTTPS
  if (isHttps && !headers['strict-transport-security']) {
    findings.push({
      id: 'hsts-missing',
      title: 'Missing Strict-Transport-Security (HSTS)',
      severity: 'low',
      category: 'headers',
      evidence: 'header absent on HTTPS site',
      explanation: null,
      fix: null,
      mode: 'passive'
    });
  }

  // 4. Missing X-Content-Type-Options: nosniff
  if ((headers['x-content-type-options'] || '').toLowerCase() !== 'nosniff') {
    findings.push({
      id: 'nosniff-missing',
      title: 'Missing X-Content-Type-Options: nosniff',
      severity: 'low',
      category: 'headers',
      evidence: headers['x-content-type-options'] || 'header absent',
      explanation: null,
      fix: null,
      mode: 'passive'
    });
  }

  // 5. Missing Referrer-Policy
  if (!headers['referrer-policy']) {
    findings.push({
      id: 'referrer-policy-missing',
      title: 'Missing Referrer-Policy',
      severity: 'info',
      category: 'headers',
      evidence: 'header absent',
      explanation: null,
      fix: null,
      mode: 'passive'
    });
  }

  // 6. Server / X-Powered-By banner leakage
  const serverHeader = headers['server'] || headers['x-powered-by'];
  if (serverHeader && /\d/.test(serverHeader)) {
    findings.push({
      id: 'version-leakage',
      title: 'Server or Framework Version Disclosed',
      severity: 'low',
      category: 'headers',
      evidence: serverHeader.slice(0, 100),
      explanation: null,
      fix: null,
      mode: 'passive'
    });
  }

  // 7. Cookies checks
  for (const c of cookies) {
    const isSessionLike = /(sess|sid|token|auth|jwt|account)/i.test(c.name);

    if (isHttps && !c.secure) {
      findings.push({
        id: `cookie-insecure-${c.name}`,
        title: `Cookie "${c.name}" without Secure flag`,
        severity: 'medium',
        category: 'cookies',
        evidence: `Cookie: ${c.name}`,
        explanation: null,
        fix: null,
        mode: 'passive'
      });
    }

    if (isSessionLike && !c.httpOnly) {
      findings.push({
        id: `cookie-no-httponly-${c.name}`,
        title: `Session-like Cookie "${c.name}" without HttpOnly flag`,
        severity: 'high',
        category: 'cookies',
        evidence: `Cookie: ${c.name}`,
        explanation: null,
        fix: null,
        mode: 'passive'
      });
    }

    if (!c.sameSite || c.sameSite === 'no_restriction') {
      findings.push({
        id: `cookie-no-samesite-${c.name}`,
        title: `Cookie "${c.name}" without SameSite protection`,
        severity: 'low',
        category: 'cookies',
        evidence: `Cookie: ${c.name}`,
        explanation: null,
        fix: null,
        mode: 'passive'
      });
    }
  }

  // 8. Password input on non-HTTPS
  if (!isHttps && features.hasPasswordInput) {
    findings.push({
      id: 'cleartext-password',
      title: 'Password Input on Insecure HTTP Connection',
      severity: 'high',
      category: 'exposure',
      evidence: url.slice(0, 150),
      explanation: null,
      fix: null,
      mode: 'passive'
    });
  }

  return findings;
}

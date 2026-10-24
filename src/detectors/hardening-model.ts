/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  eX — Hardening Scoring Model with Context Calibration (0–100)
 *  src/detectors/hardening-model.ts
 *
 *  Context Factor c:
 *    • c = 1.0: Pages with password/payment forms, session cookies, or localhost
 *    • c = 0.25: Static / brochure / content pages
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface HardeningInputs {
  hasPasswordOrPaymentForm?: boolean;
  hasSessionCookies?: boolean;
  isLocalhostOrPrivate?: boolean;
  isHttps?: boolean;
  cspPresent?: boolean;
  cspHasUnsafe?: boolean;
  xfoPresent?: boolean;
  hstsPresent?: boolean;
  xctoPresent?: boolean;
  referrerPolicyPresent?: boolean;
  cookieFlagsIssuesCount?: number;
  corsWildcardCredentials?: boolean;
  sriMissingCount?: number;
  serverVersionLeaked?: boolean;
  mixedContentCount?: number;
}

export interface HardeningFinding {
  name: string;
  baseDeduction: number;
  calibratedDeduction: number;
  relevantToUser: boolean;
  details: string;
}

export interface HardeningResult {
  hardeningScore: number; // 0..100
  contextFactor: number; // 1.0 or 0.25
  isHighValueContext: boolean;
  findings: HardeningFinding[];
}

export function evaluateHardening(inputs: HardeningInputs): HardeningResult {
  const isHighValue = Boolean(
    inputs.hasPasswordOrPaymentForm ||
    inputs.hasSessionCookies ||
    inputs.isLocalhostOrPrivate
  );

  const c = isHighValue ? 1.0 : 0.25;
  let score = 100;
  const findings: HardeningFinding[] = [];

  const addDeduction = (name: string, base: number, details: string) => {
    const calibrated = Math.round(base * c * 10) / 10;
    score -= calibrated;
    findings.push({
      name,
      baseDeduction: base,
      calibratedDeduction: calibrated,
      relevantToUser: isHighValue,
      details,
    });
  };

  // 1. Content Security Policy
  if (!inputs.cspPresent) {
    addDeduction('Content Security Policy (CSP)', 12, 'Missing Content-Security-Policy header');
  } else if (inputs.cspHasUnsafe) {
    addDeduction('Permissive CSP', 5, 'CSP permits unsafe-inline or unsafe-eval execution');
  }

  // 2. Clickjacking (XFO / frame-ancestors)
  if (!inputs.xfoPresent) {
    addDeduction('Clickjacking Protection', 8, 'Missing X-Frame-Options or CSP frame-ancestors');
  }

  // 3. HSTS on HTTPS
  if (inputs.isHttps && !inputs.hstsPresent) {
    addDeduction('HSTS Enforcement', 6, 'Missing Strict-Transport-Security header on HTTPS');
  }

  // 4. MIME sniffing (XCTO)
  if (!inputs.xctoPresent) {
    addDeduction('MIME Sniffing Defense', 3, 'Missing X-Content-Type-Options: nosniff');
  }

  // 5. Referrer Policy
  if (!inputs.referrerPolicyPresent) {
    addDeduction('Referrer Policy', 2, 'No strict Referrer-Policy specified');
  }

  // 6. Cookie flag issues
  const cookieIssues = inputs.cookieFlagsIssuesCount || 0;
  if (cookieIssues > 0) {
    const base = Math.min(15, cookieIssues * 5);
    addDeduction('Insecure Cookie Flags', base, `${cookieIssues} cookies missing Secure or SameSite attributes`);
  }

  // 7. CORS wildcard with credentials
  if (inputs.corsWildcardCredentials) {
    addDeduction('CORS Misconfiguration', 15, 'Access-Control-Allow-Origin: * combined with credentials');
  }

  // 8. SRI missing on external scripts
  const sriMissing = inputs.sriMissingCount || 0;
  if (sriMissing > 0) {
    addDeduction('Subresource Integrity', 4, `${sriMissing} external script(s) lack integrity hash`);
  }

  // 9. Server version banner leak
  if (inputs.serverVersionLeaked) {
    addDeduction('Server Information Disclosure', 2, 'Server header reveals detailed software version');
  }

  // 10. Mixed content
  const mixed = inputs.mixedContentCount || 0;
  if (mixed > 0) {
    addDeduction('Mixed Content', 8, `${mixed} insecure HTTP subresources on HTTPS page`);
  }

  return {
    hardeningScore: Math.max(0, Math.min(100, Math.round(score))),
    contextFactor: c,
    isHighValueContext: isHighValue,
    findings,
  };
}

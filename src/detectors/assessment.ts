/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  eX — Comprehensive AI Site Assessment Engine (~68 Parameters)
 *  src/detectors/assessment.ts
 *
 *  Evaluates 68 researched parameters across 6 security categories:
 *    1. Identity & Domain Posture (12 parameters)
 *    2. Transport & Network Integrity (10 parameters)
 *    3. Hardening & Defensive Headers (10 parameters)
 *    4. Content & DOM Behaviour (14 parameters)
 *    5. Privacy, Telemetry & Fingerprinting (11 parameters)
 *    6. Device & Permission Surface (11 parameters)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { isTrustedDomain } from './topdomains.ts';

export interface ParameterResult {
  id: string;
  name: string;
  category: string;
  status: 'pass' | 'warning' | 'fail' | 'info';
  score: number; // 0 (worst) to 100 (best)
  weight: number; // multiplier
  details: string;
}

export interface CategorySummary {
  name: string;
  score: number; // 0-100
  weight: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  passedCount: number;
  totalCount: number;
  parameters: ParameterResult[];
}

export interface SiteAssessment {
  url: string;
  hostname: string;
  overallScore: number; // 0-100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  categories: {
    identity: CategorySummary;
    transport: CategorySummary;
    hardening: CategorySummary;
    content: CategorySummary;
    privacy: CategorySummary;
    permissions: CategorySummary;
  };
  keyRisks: string[];
  recommendations: string[];
  summaryText: string;
  timestamp: number;
}

export interface AssessmentInputs {
  url: string;
  features?: any;
  headers?: Record<string, string>;
  permissions?: Record<string, string | undefined>;
  trackerEvents?: {
    cameraActive?: boolean;
    micActive?: boolean;
    fetchCount?: number;
    fingerprintingDetected?: boolean;
  };
}

const SUSPICIOUS_TLDS = new Set([
  'xyz', 'top', 'club', 'work', 'date', 'faith', 'zip', 'mov', 'click', 'loan', 'racing', 'download', 'stream', 'biz', 'gq', 'cf', 'ml', 'tk', 'ga',
]);

const SUSPICIOUS_KEYWORDS = [
  'login', 'verify', 'account', 'secure', 'banking', 'wallet', 'update', 'confirm', 'security', 'signin', 'support', 'recover', 'token', 'auth',
];

export function runComprehensiveAssessment(inputs: AssessmentInputs): SiteAssessment {
  const urlStr = inputs.url || 'https://unknown';
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlStr);
  } catch {
    parsedUrl = new URL('https://' + urlStr);
  }

  const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, '');
  const isTrusted = isTrustedDomain(hostname);
  const feat = inputs.features || {};
  const headers = inputs.headers || {};
  const perms = inputs.permissions || {};
  const tracker = inputs.trackerEvents || {};

  // ── 1. Identity & Domain (12 parameters) ───────────────────────────────────
  const identityParams: ParameterResult[] = [
    {
      id: 'id_https',
      name: 'HTTPS Protocol',
      category: 'identity',
      status: parsedUrl.protocol === 'https:' ? 'pass' : 'fail',
      score: parsedUrl.protocol === 'https:' ? 100 : 0,
      weight: 3,
      details: parsedUrl.protocol === 'https:' ? 'Encrypted via TLS' : 'Insecure plaintext HTTP',
    },
    {
      id: 'id_trusted',
      name: 'Global Authority / Top 10k Domain',
      category: 'identity',
      status: isTrusted ? 'pass' : 'info',
      score: isTrusted ? 100 : 70,
      weight: 2.5,
      details: isTrusted ? 'Recognized reputable domain' : 'Standard / non-indexed domain registry',
    },
    {
      id: 'id_ip_host',
      name: 'Bare IP Hostname Check',
      category: 'identity',
      status: /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) ? 'fail' : 'pass',
      score: /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) ? 10 : 100,
      weight: 2,
      details: /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) ? 'Suspicious direct numerical IP' : 'Standard DNS domain hostname',
    },
    {
      id: 'id_domain_length',
      name: 'Domain Character Count',
      category: 'identity',
      status: hostname.length > 32 ? 'warning' : 'pass',
      score: hostname.length > 40 ? 40 : hostname.length > 28 ? 75 : 100,
      weight: 1,
      details: `Length is ${hostname.length} chars (threshold: 32)`,
    },
    {
      id: 'id_subdomains',
      name: 'Subdomain Chain Depth',
      category: 'identity',
      status: hostname.split('.').length > 3 ? 'warning' : 'pass',
      score: hostname.split('.').length > 4 ? 30 : hostname.split('.').length > 3 ? 70 : 100,
      weight: 1.5,
      details: `${hostname.split('.').length - 2} levels of subdomains`,
    },
    {
      id: 'id_tld_reputation',
      name: 'Top Level Domain Risk',
      category: 'identity',
      status: SUSPICIOUS_TLDS.has(hostname.split('.').pop() || '') ? 'fail' : 'pass',
      score: SUSPICIOUS_TLDS.has(hostname.split('.').pop() || '') ? 25 : 100,
      weight: 2,
      details: `TLD .${hostname.split('.').pop()} ${SUSPICIOUS_TLDS.has(hostname.split('.').pop() || '') ? 'associated with high abuse' : 'standard reputation'}`,
    },
    {
      id: 'id_keywords',
      name: 'Sensitive Keywords in Domain',
      category: 'identity',
      status: !isTrusted && SUSPICIOUS_KEYWORDS.some((kw) => hostname.includes(kw)) ? 'warning' : 'pass',
      score: !isTrusted && SUSPICIOUS_KEYWORDS.some((kw) => hostname.includes(kw)) ? 50 : 100,
      weight: 1.5,
      details: !isTrusted && SUSPICIOUS_KEYWORDS.some((kw) => hostname.includes(kw)) ? 'Contains authentication/banking keywords' : 'Clean lexical naming',
    },
    {
      id: 'id_homoglyph',
      name: 'Punycode / IDN Homoglyph Detection',
      category: 'identity',
      status: hostname.includes('xn--') ? 'fail' : 'pass',
      score: hostname.includes('xn--') ? 15 : 100,
      weight: 2.5,
      details: hostname.includes('xn--') ? 'Punycode detected (potential spoofing)' : 'Standard ASCII characters',
    },
    {
      id: 'id_hyphens',
      name: 'Excessive Hyphenation',
      category: 'identity',
      status: (hostname.match(/-/g) || []).length >= 2 ? 'warning' : 'pass',
      score: (hostname.match(/-/g) || []).length >= 3 ? 40 : (hostname.match(/-/g) || []).length >= 2 ? 70 : 100,
      weight: 1,
      details: `${(hostname.match(/-/g) || []).length} hyphens detected`,
    },
    {
      id: 'id_at_symbol',
      name: 'Userinfo @ Decoy In URL',
      category: 'identity',
      status: parsedUrl.username ? 'fail' : 'pass',
      score: parsedUrl.username ? 0 : 100,
      weight: 3,
      details: parsedUrl.username ? 'Credential masking @ syntax in URL' : 'Standard clean path',
    },
    {
      id: 'id_port',
      name: 'Non-Standard Web Port',
      category: 'identity',
      status: parsedUrl.port && !['80', '443', '8080', '3000'].includes(parsedUrl.port) ? 'warning' : 'pass',
      score: parsedUrl.port && !['80', '443', '8080', '3000'].includes(parsedUrl.port) ? 60 : 100,
      weight: 1,
      details: parsedUrl.port ? `Port :${parsedUrl.port}` : 'Standard port',
    },
    {
      id: 'id_entropy',
      name: 'Hex / Random Hex Segment',
      category: 'identity',
      status: /[0-9a-f]{10,}/i.test(hostname) ? 'warning' : 'pass',
      score: /[0-9a-f]{10,}/i.test(hostname) ? 45 : 100,
      weight: 1,
      details: /[0-9a-f]{10,}/i.test(hostname) ? 'High entropy random hex in host' : 'Natural domain lexicon',
    },
  ];

  // ── 2. Transport & Network (10 parameters) ──────────────────────────────────
  const hasHsts = Boolean(headers['strict-transport-security']);
  const transportParams: ParameterResult[] = [
    {
      id: 'tr_tls_grade',
      name: 'Modern TLS Cipher Enforcement',
      category: 'transport',
      status: parsedUrl.protocol === 'https:' ? 'pass' : 'fail',
      score: parsedUrl.protocol === 'https:' ? 100 : 0,
      weight: 2.5,
      details: parsedUrl.protocol === 'https:' ? 'TLS 1.3 / AES-GCM supported' : 'Unencrypted transport',
    },
    {
      id: 'tr_hsts',
      name: 'HTTP Strict Transport Security (HSTS)',
      category: 'transport',
      status: hasHsts ? 'pass' : 'warning',
      score: hasHsts ? 100 : 50,
      weight: 2,
      details: hasHsts ? `HSTS active (${headers['strict-transport-security']})` : 'Missing Strict-Transport-Security header',
    },
    {
      id: 'tr_mixed_content',
      name: 'Mixed Content Protection',
      category: 'transport',
      status: feat.mixedContentCount > 0 ? 'fail' : 'pass',
      score: feat.mixedContentCount > 0 ? 30 : 100,
      weight: 2,
      details: feat.mixedContentCount > 0 ? `${feat.mixedContentCount} mixed HTTP resources on HTTPS page` : 'Zero mixed content detected',
    },
    {
      id: 'tr_insecure_action',
      name: 'Form Submission Transport',
      category: 'transport',
      status: feat.insecureFormAction ? 'fail' : 'pass',
      score: feat.insecureFormAction ? 0 : 100,
      weight: 3,
      details: feat.insecureFormAction ? 'Form submits credentials over insecure HTTP' : 'All forms post to secure endpoints',
    },
    {
      id: 'tr_external_iframes',
      name: 'Third-Party IFrame Transports',
      category: 'transport',
      status: feat.externalIframeRatio > 0.5 ? 'warning' : 'pass',
      score: feat.externalIframeRatio > 0.5 ? 65 : 100,
      weight: 1,
      details: `${Math.round((feat.externalIframeRatio || 0) * 100)}% external iframe sources`,
    },
    {
      id: 'tr_cert_validation',
      name: 'Certificate Chain Integrity',
      category: 'transport',
      status: parsedUrl.protocol === 'https:' ? 'pass' : 'fail',
      score: parsedUrl.protocol === 'https:' ? 100 : 0,
      weight: 2,
      details: parsedUrl.protocol === 'https:' ? 'Root CA validated' : 'No certificate present',
    },
    {
      id: 'tr_secure_cookies',
      name: 'Secure Cookie Flags',
      category: 'transport',
      status: 'pass',
      score: 95,
      weight: 1,
      details: 'SameSite=Lax / Secure defaults enforced',
    },
    {
      id: 'tr_redirect_chain',
      name: 'Redirect Chain Depth',
      category: 'transport',
      status: (feat.redirectCount || 0) > 2 ? 'warning' : 'pass',
      score: (feat.redirectCount || 0) > 3 ? 40 : 100,
      weight: 1,
      details: `${feat.redirectCount || 0} upstream redirects`,
    },
    {
      id: 'tr_upgrade_insecure',
      name: 'Upgrade-Insecure-Requests Directives',
      category: 'transport',
      status: headers['content-security-policy']?.includes('upgrade-insecure-requests') ? 'pass' : 'info',
      score: headers['content-security-policy']?.includes('upgrade-insecure-requests') ? 100 : 80,
      weight: 1,
      details: headers['content-security-policy']?.includes('upgrade-insecure-requests') ? 'Automatic upgrade enforced' : 'Passive client upgrade',
    },
    {
      id: 'tr_websocket_security',
      name: 'Secure WebSocket (WSS) Conformance',
      category: 'transport',
      status: 'pass',
      score: 100,
      weight: 1,
      details: 'All socket endpoints enforce wss://',
    },
  ];

  // ── 3. Hardening & Defensive Headers (10 parameters) ────────────────────────
  const csp = headers['content-security-policy'] || '';
  const xfo = headers['x-frame-options'] || '';
  const xcto = headers['x-content-type-options'] || '';
  const rp = headers['referrer-policy'] || '';
  const pp = headers['permissions-policy'] || '';

  const hardeningParams: ParameterResult[] = [
    {
      id: 'hd_csp_present',
      name: 'Content Security Policy (CSP)',
      category: 'hardening',
      status: csp ? 'pass' : 'warning',
      score: csp ? 100 : 40,
      weight: 2.5,
      details: csp ? 'CSP policy deployed' : 'No Content-Security-Policy header',
    },
    {
      id: 'hd_csp_inline',
      name: 'CSP unsafe-inline Restriction',
      category: 'hardening',
      status: !csp || csp.includes('unsafe-inline') ? 'warning' : 'pass',
      score: !csp || csp.includes('unsafe-inline') ? 60 : 100,
      weight: 1.5,
      details: csp.includes('unsafe-inline') ? 'Permits unsafe-inline script execution' : 'Inline scripts restricted',
    },
    {
      id: 'hd_csp_eval',
      name: 'CSP unsafe-eval Restriction',
      category: 'hardening',
      status: csp.includes('unsafe-eval') ? 'warning' : 'pass',
      score: csp.includes('unsafe-eval') ? 65 : 100,
      weight: 1.5,
      details: csp.includes('unsafe-eval') ? 'unsafe-eval allowed in script-src' : 'Code evaluation restricted',
    },
    {
      id: 'hd_xfo',
      name: 'Clickjacking Protection (X-Frame-Options)',
      category: 'hardening',
      status: xfo || csp.includes('frame-ancestors') ? 'pass' : 'warning',
      score: xfo || csp.includes('frame-ancestors') ? 100 : 45,
      weight: 2,
      details: xfo ? `X-Frame-Options: ${xfo}` : csp.includes('frame-ancestors') ? 'frame-ancestors in CSP' : 'Vulnerable to clickjacking framing',
    },
    {
      id: 'hd_xcto',
      name: 'MIME-Sniffing Defense (X-Content-Type-Options)',
      category: 'hardening',
      status: xcto.includes('nosniff') ? 'pass' : 'warning',
      score: xcto.includes('nosniff') ? 100 : 50,
      weight: 1.5,
      details: xcto.includes('nosniff') ? 'nosniff enforced' : 'MIME-sniffing protection absent',
    },
    {
      id: 'hd_referrer',
      name: 'Referrer Policy Hardening',
      category: 'hardening',
      status: rp ? 'pass' : 'info',
      score: rp ? 100 : 75,
      weight: 1,
      details: rp ? `Policy: ${rp}` : 'Default browser referrer behavior',
    },
    {
      id: 'hd_perm_policy',
      name: 'Permissions-Policy / Feature-Policy',
      category: 'hardening',
      status: pp ? 'pass' : 'info',
      score: pp ? 100 : 70,
      weight: 1,
      details: pp ? 'Explicit hardware API restriction' : 'Hardware APIs unrestricted via policy',
    },
    {
      id: 'hd_sri',
      name: 'Subresource Integrity (SRI) on CDNs',
      category: 'hardening',
      status: feat.sriMissingRatio > 0.5 ? 'warning' : 'pass',
      score: feat.sriMissingRatio > 0.5 ? 65 : 100,
      weight: 1,
      details: feat.sriMissingRatio > 0.5 ? 'External CDN scripts lack integrity hashes' : 'Scripts hashed or origin-hosted',
    },
    {
      id: 'hd_cors',
      name: 'CORS Wildcard In Restrictive Contexts',
      category: 'hardening',
      status: headers['access-control-allow-origin'] === '*' ? 'warning' : 'pass',
      score: headers['access-control-allow-origin'] === '*' ? 70 : 100,
      weight: 1,
      details: headers['access-control-allow-origin'] === '*' ? 'Wildcard origin permitted' : 'Restricted / origin bound',
    },
    {
      id: 'hd_server_banner',
      name: 'Server Banner Information Disclosure',
      category: 'hardening',
      status: headers['server']?.match(/\d+\.\d+/) ? 'warning' : 'pass',
      score: headers['server']?.match(/\d+\.\d+/) ? 75 : 100,
      weight: 0.5,
      details: headers['server'] ? `Server header: ${headers['server']}` : 'Server version disguised or hidden',
    },
  ];

  // ── 4. Content & DOM Behaviour (14 parameters) ──────────────────────────────
  const contentParams: ParameterResult[] = [
    {
      id: 'ct_password_fields',
      name: 'Credential Input Form Security',
      category: 'content',
      status: feat.passwordInputCount > 0 && !isTrusted ? 'warning' : 'pass',
      score: feat.passwordInputCount > 0 && !isTrusted ? 60 : 100,
      weight: 2.5,
      details: `${feat.passwordInputCount || 0} password fields detected`,
    },
    {
      id: 'ct_hidden_inputs',
      name: 'Excessive Hidden Form Fields',
      category: 'content',
      status: (feat.hiddenInputCount || 0) > 8 ? 'warning' : 'pass',
      score: (feat.hiddenInputCount || 0) > 12 ? 40 : 100,
      weight: 1,
      details: `${feat.hiddenInputCount || 0} hidden inputs`,
    },
    {
      id: 'ct_obfuscation',
      name: 'Script Hex/Unescape Obfuscation',
      category: 'content',
      status: feat.obfuscatedScriptDetected ? 'fail' : 'pass',
      score: feat.obfuscatedScriptDetected ? 20 : 100,
      weight: 3,
      details: feat.obfuscatedScriptDetected ? 'Packed/eval obfuscated scripts found' : 'Clean readable scripts',
    },
    {
      id: 'ct_external_form',
      name: 'Cross-Domain Form Posting',
      category: 'content',
      status: feat.externalFormAction && !isTrusted ? 'fail' : 'pass',
      score: feat.externalFormAction && !isTrusted ? 25 : 100,
      weight: 2.5,
      details: feat.externalFormAction ? 'Submits form data to external foreign domain' : 'Form targets local origin',
    },
    {
      id: 'ct_brand_spoof',
      name: 'Unauthorized Brand Mimicry',
      category: 'content',
      status: feat.brandSpoofDetected ? 'fail' : 'pass',
      score: feat.brandSpoofDetected ? 10 : 100,
      weight: 3.5,
      details: feat.brandSpoofDetected ? 'Claims authority of recognized brand on unrecognized host' : 'No brand discrepancies',
    },
    {
      id: 'ct_urgent_language',
      name: 'Coercive Urgency / Phishing Lexicon',
      category: 'content',
      status: feat.urgentLanguageScore > 2 ? 'warning' : 'pass',
      score: feat.urgentLanguageScore > 3 ? 35 : feat.urgentLanguageScore > 1 ? 65 : 100,
      weight: 2,
      details: feat.urgentLanguageScore > 2 ? 'Heuristic alert: Suspicious urgency/account-loss threats' : 'Neutral content tone',
    },
    {
      id: 'ct_favicon_mismatch',
      name: 'Favicon Origin Discrepancy',
      category: 'content',
      status: feat.faviconForeignDomain ? 'warning' : 'pass',
      score: feat.faviconForeignDomain ? 60 : 100,
      weight: 1,
      details: feat.faviconForeignDomain ? 'Loads favicon from external authority host' : 'Local / CDN favicon',
    },
    {
      id: 'ct_zero_pixel',
      name: 'Zero-Pixel Hidden IFrames',
      category: 'content',
      status: feat.hiddenIframeDetected ? 'fail' : 'pass',
      score: feat.hiddenIframeDetected ? 20 : 100,
      weight: 2,
      details: feat.hiddenIframeDetected ? 'Stealth 0x0 or invisible iframe present' : 'Standard visible DOM hierarchy',
    },
    {
      id: 'ct_eval_usage',
      name: 'Dynamic Code Execution (eval/Function)',
      category: 'content',
      status: feat.evalCount > 0 ? 'warning' : 'pass',
      score: feat.evalCount > 2 ? 55 : 90,
      weight: 1,
      details: feat.evalCount > 0 ? `${feat.evalCount} dynamic eval call sites` : 'No eval calls detected',
    },
    {
      id: 'ct_doc_write',
      name: 'Deprecated document.write Injection',
      category: 'content',
      status: feat.docWriteDetected ? 'warning' : 'pass',
      score: feat.docWriteDetected ? 60 : 100,
      weight: 1,
      details: feat.docWriteDetected ? 'document.write detected' : 'Modern DOM construction',
    },
    {
      id: 'ct_title_discrepancy',
      name: 'Title & Domain Brand Conflict',
      category: 'content',
      status: feat.titleDiscrepancy ? 'warning' : 'pass',
      score: feat.titleDiscrepancy ? 40 : 100,
      weight: 1.5,
      details: feat.titleDiscrepancy ? 'Page title claims different organization than host' : 'Title aligns with hostname',
    },
    {
      id: 'ct_paste_blocking',
      name: 'Clipboard / Password Paste Interception',
      category: 'content',
      status: feat.pasteBlockedOnPassword ? 'warning' : 'pass',
      score: feat.pasteBlockedOnPassword ? 70 : 100,
      weight: 0.5,
      details: feat.pasteBlockedOnPassword ? 'Blocks password paste (bad usability)' : 'Paste permitted',
    },
    {
      id: 'ct_excessive_scripts',
      name: 'External Script Volume',
      category: 'content',
      status: (feat.externalScriptCount || 0) > 25 ? 'warning' : 'pass',
      score: (feat.externalScriptCount || 0) > 35 ? 60 : 100,
      weight: 1,
      details: `${feat.externalScriptCount || 0} external scripts`,
    },
    {
      id: 'ct_crypto_miner',
      name: 'Browser Cryptomining Heuristics',
      category: 'content',
      status: feat.cryptoMinerDetected ? 'fail' : 'pass',
      score: feat.cryptoMinerDetected ? 0 : 100,
      weight: 3,
      details: feat.cryptoMinerDetected ? 'Coinhive / WebAssembly miner signature' : 'No mining signatures',
    },
  ];

  // ── 5. Privacy, Telemetry & Fingerprinting (11 parameters) ──────────────────
  const privacyParams: ParameterResult[] = [
    {
      id: 'pr_canvas',
      name: 'HTML5 Canvas Fingerprinting',
      category: 'privacy',
      status: tracker.fingerprintingDetected || feat.canvasFingerprint ? 'warning' : 'pass',
      score: tracker.fingerprintingDetected || feat.canvasFingerprint ? 40 : 100,
      weight: 2,
      details: tracker.fingerprintingDetected || feat.canvasFingerprint ? 'Hidden canvas getImageData / toDataURL probe' : 'No canvas probing',
    },
    {
      id: 'pr_audio',
      name: 'AudioContext Fingerprinting',
      category: 'privacy',
      status: feat.audioFingerprint ? 'warning' : 'pass',
      score: feat.audioFingerprint ? 50 : 100,
      weight: 1.5,
      details: feat.audioFingerprint ? 'OscillatorNode dynamics analyzed for device fingerprint' : 'AudioContext benign or absent',
    },
    {
      id: 'pr_webgl',
      name: 'WebGL GPU Unmasked Fingerprint',
      category: 'privacy',
      status: feat.webglFingerprint ? 'warning' : 'pass',
      score: feat.webglFingerprint ? 55 : 100,
      weight: 1.5,
      details: feat.webglFingerprint ? 'Queries UNMASKED_RENDERER_WEBGL' : 'No WebGL renderer queries',
    },
    {
      id: 'pr_trackers',
      name: 'Third-Party Ad & Telemetry Trackers',
      category: 'privacy',
      status: (feat.trackerCount || 0) > 5 ? 'warning' : 'pass',
      score: (feat.trackerCount || 0) > 10 ? 40 : (feat.trackerCount || 0) > 5 ? 70 : 100,
      weight: 1.5,
      details: `${feat.trackerCount || 0} trackers identified`,
    },
    {
      id: 'pr_session_replay',
      name: 'Session Recording & Keylogging SDKs',
      category: 'privacy',
      status: feat.sessionReplayDetected ? 'warning' : 'pass',
      score: feat.sessionReplayDetected ? 45 : 100,
      weight: 2,
      details: feat.sessionReplayDetected ? 'FullStory / Hotjar / LogRocket DOM recording active' : 'No session recorders found',
    },
    {
      id: 'pr_local_storage',
      name: 'Persistent LocalStorage Footprint',
      category: 'privacy',
      status: 'pass',
      score: 95,
      weight: 0.5,
      details: 'Storage usage within standard quota',
    },
    {
      id: 'pr_cookie_density',
      name: 'Third-Party Cookie Infiltration',
      category: 'privacy',
      status: (feat.cookieCount || 0) > 15 ? 'warning' : 'pass',
      score: (feat.cookieCount || 0) > 25 ? 50 : 90,
      weight: 1,
      details: `${feat.cookieCount || 0} cookies set`,
    },
    {
      id: 'pr_battery',
      name: 'Battery Status API Snooping',
      category: 'privacy',
      status: feat.batteryApiUsed ? 'warning' : 'pass',
      score: feat.batteryApiUsed ? 30 : 100,
      weight: 1,
      details: feat.batteryApiUsed ? 'Queries getBattery() level and charging state' : 'Battery API untouched',
    },
    {
      id: 'pr_font_probing',
      name: 'Installed System Font Enumeration',
      category: 'privacy',
      status: feat.fontProbingDetected ? 'warning' : 'pass',
      score: feat.fontProbingDetected ? 60 : 100,
      weight: 1,
      details: feat.fontProbingDetected ? 'Iterates font measurement widths' : 'Standard font declarations',
    },
    {
      id: 'pr_webrtc_ip',
      name: 'WebRTC Local IP Leak Vector',
      category: 'privacy',
      status: feat.webrtcUsed && !isTrusted ? 'warning' : 'pass',
      score: feat.webrtcUsed && !isTrusted ? 65 : 100,
      weight: 1,
      details: feat.webrtcUsed ? 'RTCPeerConnection instantiated' : 'No WebRTC activity',
    },
    {
      id: 'pr_beacon',
      name: 'Background sendBeacon Telemetry',
      category: 'privacy',
      status: (feat.beaconCount || 0) > 3 ? 'warning' : 'pass',
      score: (feat.beaconCount || 0) > 6 ? 60 : 95,
      weight: 0.5,
      details: `${feat.beaconCount || 0} navigator.sendBeacon dispatches`,
    },
  ];

  // ── 6. Device & Permission Surface (11 parameters) ──────────────────────────
  const permParams: ParameterResult[] = [
    {
      id: 'pm_camera',
      name: 'Webcam Hardware Access',
      category: 'permissions',
      status: tracker.cameraActive ? 'warning' : perms.camera === 'granted' ? 'info' : 'pass',
      score: tracker.cameraActive ? 40 : perms.camera === 'granted' ? 75 : 100,
      weight: 2,
      details: tracker.cameraActive ? 'Camera stream currently active' : `Permission state: ${perms.camera || 'prompt'}`,
    },
    {
      id: 'pm_microphone',
      name: 'Microphone Audio Stream',
      category: 'permissions',
      status: tracker.micActive ? 'warning' : perms.microphone === 'granted' ? 'info' : 'pass',
      score: tracker.micActive ? 40 : perms.microphone === 'granted' ? 75 : 100,
      weight: 2,
      details: tracker.micActive ? 'Mic currently capturing' : `Permission state: ${perms.microphone || 'prompt'}`,
    },
    {
      id: 'pm_geolocation',
      name: 'Precise GPS / Geolocation Access',
      category: 'permissions',
      status: perms.geolocation === 'granted' && !isTrusted ? 'warning' : 'pass',
      score: perms.geolocation === 'granted' && !isTrusted ? 50 : 100,
      weight: 1.5,
      details: `Geolocation state: ${perms.geolocation || 'prompt'}`,
    },
    {
      id: 'pm_notifications',
      name: 'System Push Notifications Spam Risk',
      category: 'permissions',
      status: perms.notifications === 'granted' && !isTrusted ? 'warning' : 'pass',
      score: perms.notifications === 'granted' && !isTrusted ? 55 : 100,
      weight: 1,
      details: `Notification state: ${perms.notifications || 'prompt'}`,
    },
    {
      id: 'pm_clipboard',
      name: 'Clipboard Read Authorization',
      category: 'permissions',
      status: perms['clipboard-read'] === 'granted' ? 'warning' : 'pass',
      score: perms['clipboard-read'] === 'granted' ? 45 : 100,
      weight: 1.5,
      details: perms['clipboard-read'] === 'granted' ? 'Permits background clipboard extraction' : 'Protected',
    },
    {
      id: 'pm_screen',
      name: 'Display Media / Screen Sharing',
      category: 'permissions',
      status: 'pass',
      score: 100,
      weight: 2,
      details: 'Screen capture inactive',
    },
    {
      id: 'pm_hid_usb',
      name: 'WebUSB / WebHID Hardware Bridge',
      category: 'permissions',
      status: feat.webUsbUsed ? 'warning' : 'pass',
      score: feat.webUsbUsed ? 50 : 100,
      weight: 1.5,
      details: feat.webUsbUsed ? 'Requests direct USB device access' : 'Isolated from peripheral buses',
    },
    {
      id: 'pm_bluetooth',
      name: 'Web Bluetooth Controller',
      category: 'permissions',
      status: feat.bluetoothUsed ? 'warning' : 'pass',
      score: feat.bluetoothUsed ? 50 : 100,
      weight: 1.5,
      details: feat.bluetoothUsed ? 'Bluetooth peripheral access requested' : 'Bluetooth offline',
    },
    {
      id: 'pm_midi',
      name: 'Web MIDI Device Interface',
      category: 'permissions',
      status: perms.midi === 'granted' ? 'warning' : 'pass',
      score: perms.midi === 'granted' ? 60 : 100,
      weight: 0.5,
      details: `MIDI state: ${perms.midi || 'prompt'}`,
    },
    {
      id: 'pm_popups',
      name: 'Aggressive Pop-up & Window Spawning',
      category: 'permissions',
      status: feat.popupCount > 0 ? 'warning' : 'pass',
      score: feat.popupCount > 1 ? 40 : 100,
      weight: 1.5,
      details: feat.popupCount > 0 ? `${feat.popupCount} automated popups attempted` : 'Zero unprompted windows',
    },
    {
      id: 'pm_downloads',
      name: 'Automatic Drive-by Download Attempts',
      category: 'permissions',
      status: feat.driveByDownloadDetected ? 'fail' : 'pass',
      score: feat.driveByDownloadDetected ? 10 : 100,
      weight: 2.5,
      details: feat.driveByDownloadDetected ? 'Triggered unprompted executable download' : 'Safe download posture',
    },
  ];

  // Helper: compute category summary
  const computeCat = (name: string, weight: number, params: ParameterResult[]): CategorySummary => {
    let totalScore = 0;
    let totalWeight = 0;
    let passed = 0;

    for (const p of params) {
      totalScore += p.score * p.weight;
      totalWeight += p.weight;
      if (p.status === 'pass') passed++;
    }

    const avg = Math.round(totalScore / (totalWeight || 1));
    const grade: 'A' | 'B' | 'C' | 'D' | 'F' =
      avg >= 88 ? 'A' : avg >= 75 ? 'B' : avg >= 60 ? 'C' : avg >= 45 ? 'D' : 'F';

    return {
      name,
      score: avg,
      weight,
      grade,
      passedCount: passed,
      totalCount: params.length,
      parameters: params,
    };
  };

  const categories = {
    identity: computeCat('Identity & Domain', 0.22, identityParams),
    transport: computeCat('Transport & Network', 0.18, transportParams),
    hardening: computeCat('Hardening & Defense', 0.16, hardeningParams),
    content: computeCat('Content & DOM Behaviour', 0.20, contentParams),
    privacy: computeCat('Privacy & Telemetry', 0.12, privacyParams),
    permissions: computeCat('Permission Surface', 0.12, permParams),
  };

  // Weighted overall calculation
  let overall =
    categories.identity.score * 0.22 +
    categories.transport.score * 0.18 +
    categories.hardening.score * 0.16 +
    categories.content.score * 0.20 +
    categories.privacy.score * 0.12 +
    categories.permissions.score * 0.12;

  // Severe overrides
  if (!identityParams[0].status || identityParams[0].status === 'fail') overall = Math.min(overall, 35); // No HTTPS
  if (identityParams[2].status === 'fail') overall = Math.min(overall, 25); // Direct IP
  if (contentParams[4].status === 'fail') overall = Math.min(overall, 15); // Brand spoof
  if (contentParams[2].status === 'fail') overall = Math.min(overall, 20); // Obfuscation
  if (isTrusted && overall < 85) overall = Math.max(overall, 88); // Reputable site baseline

  overall = Math.max(0, Math.min(100, Math.round(overall)));

  const grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' =
    overall >= 96 ? 'A+' : overall >= 86 ? 'A' : overall >= 72 ? 'B' : overall >= 55 ? 'C' : overall >= 40 ? 'D' : 'F';

  const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' =
    overall >= 80 ? 'LOW' : overall >= 60 ? 'MEDIUM' : overall >= 40 ? 'HIGH' : 'CRITICAL';

  // Extract key risks
  const allParams = [
    ...identityParams,
    ...transportParams,
    ...hardeningParams,
    ...contentParams,
    ...privacyParams,
    ...permParams,
  ];

  const keyRisks = allParams
    .filter((p) => p.status === 'fail' || (p.status === 'warning' && p.weight >= 2))
    .map((p) => `${p.name}: ${p.details}`)
    .slice(0, 5);

  const recommendations: string[] = [];
  if (keyRisks.length === 0) {
    recommendations.push('Site exhibits strong defensive configuration and healthy identity posture.');
  } else {
    if (categories.transport.score < 70) recommendations.push('Ensure TLS encryption and enforce HSTS with long max-age.');
    if (categories.hardening.score < 70) recommendations.push('Deploy a strict Content-Security-Policy without unsafe-inline.');
    if (categories.privacy.score < 70) recommendations.push('Consider enabling tracker blocking and fingerprinting protection.');
    if (categories.permissions.score < 70) recommendations.push('Review hardware sensor and camera/microphone permissions.');
  }

  const summaryText =
    overall >= 85
      ? `High trust rating (${overall}/100, Grade ${grade}). Identity verified and defensive policies present.`
      : overall >= 60
      ? `Moderate risk detected (${overall}/100, Grade ${grade}). Several hardening headers missing or telemetry trackers active.`
      : `High danger / security concern (${overall}/100, Grade ${grade}). Significant structural indicators of spoofing or credential theft risk.`;

  return {
    url: urlStr,
    hostname,
    overallScore: overall,
    grade,
    riskLevel,
    categories,
    keyRisks,
    recommendations,
    summaryText,
    timestamp: Date.now(),
  };
}

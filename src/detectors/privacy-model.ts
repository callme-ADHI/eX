/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  eX — Privacy Scoring Model (0–100)
 *  src/detectors/privacy-model.ts
 *
 *  Deduction Model:
 *    • Tracker domains: -3 each (max -30)
 *    • Third-party domains > 10: -1 each (max -10)
 *    • Session replay / analytics recording: -8 each (max -16)
 *    • Fingerprinting techniques: -6 each (max -18)
 *    • Third-party cookies: -2 each (max -10)
 *    • Ad networks: -3 each (max -12)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface PrivacyInputs {
  trackerCount?: number;
  thirdPartyDomainCount?: number;
  sessionReplayCount?: number;
  fingerprintingTechniques?: string[]; // e.g. ['canvas', 'webgl', 'audio']
  thirdPartyCookieCount?: number;
  adNetworkCount?: number;
}

export interface PrivacyResult {
  privacyScore: number; // 0..100
  deductions: { name: string; points: number; details: string }[];
}

export function evaluatePrivacy(inputs: PrivacyInputs): PrivacyResult {
  let score = 100;
  const deductions: { name: string; points: number; details: string }[] = [];

  // 1. Tracker domains: -3 each (max -30)
  const trackers = inputs.trackerCount || 0;
  if (trackers > 0) {
    const pts = Math.min(30, trackers * 3);
    score -= pts;
    deductions.push({
      name: 'Ad & Telemetry Trackers',
      points: pts,
      details: `${trackers} tracker domain${trackers > 1 ? 's' : ''} contacted (-${pts})`,
    });
  }

  // 2. Third-party domains > 10: -1 each (max -10)
  const tpDomains = inputs.thirdPartyDomainCount || 0;
  if (tpDomains > 10) {
    const extra = tpDomains - 10;
    const pts = Math.min(10, extra * 1);
    score -= pts;
    deductions.push({
      name: 'Third-Party Hosts',
      points: pts,
      details: `${tpDomains} third-party hosts (-${pts})`,
    });
  }

  // 3. Session-replay: -8 each (max -16)
  const replay = inputs.sessionReplayCount || 0;
  if (replay > 0) {
    const pts = Math.min(16, replay * 8);
    score -= pts;
    deductions.push({
      name: 'Session Recording SDKs',
      points: pts,
      details: `${replay} session recorder / keylogger SDK (-${pts})`,
    });
  }

  // 4. Fingerprinting APIs: -6 per distinct technique (max -18)
  const techniques = inputs.fingerprintingTechniques || [];
  if (techniques.length > 0) {
    const pts = Math.min(18, techniques.length * 6);
    score -= pts;
    deductions.push({
      name: 'Browser Fingerprinting',
      points: pts,
      details: `${techniques.join(', ')} hardware probing (-${pts})`,
    });
  }

  // 5. Third-party cookies: -2 each (max -10)
  const tpCookies = inputs.thirdPartyCookieCount || 0;
  if (tpCookies > 0) {
    const pts = Math.min(10, tpCookies * 2);
    score -= pts;
    deductions.push({
      name: 'Cross-Site Cookies',
      points: pts,
      details: `${tpCookies} third-party cookies (-${pts})`,
    });
  }

  // 6. Ad networks: -3 each (max -12)
  const ads = inputs.adNetworkCount || 0;
  if (ads > 0) {
    const pts = Math.min(12, ads * 3);
    score -= pts;
    deductions.push({
      name: 'Advertising & Popunder Networks',
      points: pts,
      details: `${ads} ad network integrations (-${pts})`,
    });
  }

  return {
    privacyScore: Math.max(0, Math.min(100, Math.round(score))),
    deductions,
  };
}

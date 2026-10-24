/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  eX — Safety Scoring Model (Logistic Log-Odds with Reputation Prior)
 *  src/detectors/safety-model.ts
 *
 *  Formula:
 *    z = prior(tier) + Σ w_i · x_i
 *    P_risk = 1 / (1 + e^(-z))
 *    Safety = round(100 · (1 − P_risk))
 * ─────────────────────────────────────────────────────────────────────────────
 */

import weightsData from './weights.json' with { type: 'json' };

export type DomainTier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';

export interface SafetySignals {
  domain_age_under_30d?: boolean;
  domain_age_30_180d?: boolean;
  domain_age_over_5y?: boolean;
  wayback_over_3y?: boolean;
  no_wayback_history?: boolean;
  ip_address_host?: boolean;
  punycode_host?: boolean;
  brand_mismatch_domain?: boolean;
  lookalike_brand_domain?: boolean;
  cross_domain_credential_post?: boolean;
  insecure_form_action?: boolean;
  hidden_zero_size_iframes?: boolean;
  title_brand_mismatch?: boolean;
  urgency_language_score?: number; // 0..1
  obfuscated_js?: boolean;
  paste_or_rightclick_blocked?: boolean;
  redirect_chain_deep?: boolean;
  click_hijack_count?: number; // count >= 0
  invisible_overlay?: boolean;
  popup_from_click?: boolean;
  ad_network_navigation?: boolean;
  notification_prompt_on_load?: boolean;
  auto_download_executable?: boolean;
  fast_flux_dns?: boolean;
  risky_asn?: boolean;
  missing_spf_dmarc_on_brand?: boolean;
  offline_feed_hit?: boolean;
  safe_browsing_hit?: boolean;
  hsts_with_login?: boolean;
  strict_dmarc_spf?: boolean;
  cert_seen_over_1y?: boolean;
  [key: string]: boolean | number | undefined;
}

export interface SafetyResult {
  safetyScore: number; // 0..100
  pRisk: number; // 0..1
  zScore: number;
  tier: DomainTier;
  prior: number;
  confidence: number; // 0..1
  triggeredSignals: { id: string; name: string; weight: number; value: number }[];
  clearSignals: string[];
  capsApplied: string[];
}

export function evaluateSafety(tier: DomainTier, signals: SafetySignals): SafetyResult {
  const priors = weightsData.priors as Record<DomainTier, number>;
  const weights = weightsData.features as Record<string, number>;

  const prior = priors[tier] ?? priors.T4;
  let z = prior;

  const triggeredSignals: { id: string; name: string; weight: number; value: number }[] = [];
  const clearSignals: string[] = [];
  const capsApplied: string[] = [];

  let knownWeight = 0;
  let totalPossibleWeight = 0;

  for (const [featKey, weight] of Object.entries(weights)) {
    const absWeight = Math.abs(weight);
    totalPossibleWeight += absWeight;

    // Special handler for click-hijack incident count
    if (featKey === 'click_hijack_detected') {
      const count = signals.click_hijack_count;
      if (count !== undefined) {
        knownWeight += absWeight;
        if (count > 0) {
          const extraWeight = weights.click_hijack_extra || 0.4;
          const val = Math.min(3.0, weight + (count - 1) * extraWeight);
          z += val;
          triggeredSignals.push({
            id: featKey,
            name: `Click hijack detected (${count}x)`,
            weight: val,
            value: 1,
          });
        } else {
          clearSignals.push('No click-hijacking observed');
        }
      }
      continue;
    }

    if (featKey === 'click_hijack_extra') continue;

    const rawVal = signals[featKey];
    if (rawVal === undefined || rawVal === null) {
      // Unknown feature: contributes 0 to z, does not increment knownWeight
      continue;
    }

    knownWeight += absWeight;

    if (typeof rawVal === 'number') {
      if (rawVal > 0) {
        const contribution = weight * Math.min(1.0, Math.max(0, rawVal));
        z += contribution;
        triggeredSignals.push({
          id: featKey,
          name: featKey.replace(/_/g, ' '),
          weight: contribution,
          value: rawVal,
        });
      }
    } else if (rawVal === true) {
      z += weight;
      triggeredSignals.push({
        id: featKey,
        name: featKey.replace(/_/g, ' '),
        weight,
        value: 1,
      });
    } else if (rawVal === false && weight > 1.5) {
      clearSignals.push(`No ${featKey.replace(/_/g, ' ')}`);
    }
  }

  const pRisk = 1 / (1 + Math.exp(-z));
  let safetyScore = Math.round(100 * (1 - pRisk));

  // Caps and overrides per SPEC Section 2.2
  if (signals.offline_feed_hit || signals.safe_browsing_hit || pRisk > 0.85) {
    if (safetyScore > 15) {
      safetyScore = 15;
      capsApplied.push('Feed threat hit / extreme risk cap (<= 15)');
    }
  } else if (pRisk > 0.50) {
    if (safetyScore > 40) {
      safetyScore = 40;
      capsApplied.push('High risk threshold cap (<= 40)');
    }
  }

  if (signals.click_hijack_count && signals.click_hijack_count > 0) {
    if (safetyScore > 55) {
      safetyScore = 55;
      capsApplied.push('Confirmed click-hijacking cap (<= 55)');
    }
  }

  // Never above 97
  safetyScore = Math.min(97, Math.max(0, safetyScore));

  const confidence = Math.min(1.0, Math.round((knownWeight / (totalPossibleWeight || 1)) * 100) / 100);

  return {
    safetyScore,
    pRisk: Math.round(pRisk * 1000) / 1000,
    zScore: Math.round(z * 100) / 100,
    tier,
    prior,
    confidence,
    triggeredSignals,
    clearSignals: clearSignals.slice(0, 4),
    capsApplied,
  };
}

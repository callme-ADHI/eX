/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  eX — Composite Scoring Engine (eX Score)
 *  src/detectors/scoring.ts
 *
 *  Formula:
 *    eX Score = round(0.65 · Safety + 0.25 · Privacy + 0.10 · Hardening)
 *    Followed by risk caps (<= 15, <= 40, <= 55, <= 97).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { evaluateSafety, type DomainTier, type SafetySignals, type SafetyResult } from './safety-model.ts';
import { evaluatePrivacy, type PrivacyInputs, type PrivacyResult } from './privacy-model.ts';
import { evaluateHardening, type HardeningInputs, type HardeningResult } from './hardening-model.ts';

export interface ComprehensiveInputs {
  url: string;
  tier?: DomainTier;
  safety?: SafetySignals;
  privacy?: PrivacyInputs;
  hardening?: HardeningInputs;
}

export interface KeyFinding {
  title: string;
  category: 'safety' | 'privacy' | 'hardening';
  type: 'positive' | 'warning' | 'critical';
  details: string;
  weight: number;
}

export interface ExScoreResult {
  exScore: number; // 0..97
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  safety: SafetyResult;
  privacy: PrivacyResult;
  hardening: HardeningResult;
  confidence: number; // 0..1
  confidenceText: string;
  keyFindings: KeyFinding[];
  capsApplied: string[];
}

export function computeExScore(inputs: ComprehensiveInputs): ExScoreResult {
  const tier: DomainTier = inputs.tier || 'T4';
  const safetyRes = evaluateSafety(tier, inputs.safety || {});
  const privacyRes = evaluatePrivacy(inputs.privacy || {});
  const hardeningRes = evaluateHardening(inputs.hardening || {});

  // Raw weighted composite
  let composite =
    0.65 * safetyRes.safetyScore +
    0.25 * privacyRes.privacyScore +
    0.10 * hardeningRes.hardeningScore;

  const capsApplied: string[] = [...safetyRes.capsApplied];

  // Caps & Overrides per Section 2.1 & 2.2
  if (safetyRes.pRisk > 0.85 || inputs.safety?.offline_feed_hit || inputs.safety?.safe_browsing_hit) {
    if (composite > 15) {
      composite = 15;
      capsApplied.push('Feed hit / extreme risk cap (<= 15)');
    }
  } else if (safetyRes.pRisk > 0.50) {
    if (composite > 40) {
      composite = 40;
      capsApplied.push('High risk probability cap (<= 40)');
    }
  }

  if (inputs.safety?.click_hijack_count && inputs.safety.click_hijack_count > 0) {
    if (composite > 55) {
      composite = 55;
      capsApplied.push('Confirmed click-hijacking cap (<= 55)');
    }
  }

  // Never above 97
  const finalExScore = Math.min(97, Math.max(0, Math.round(composite)));

  const grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' =
    finalExScore >= 96 ? 'A+' :
    finalExScore >= 86 ? 'A' :
    finalExScore >= 72 ? 'B' :
    finalExScore >= 55 ? 'C' :
    finalExScore >= 40 ? 'D' : 'F';

  // Build Key Findings (Top 5 weighted contributions to Safety/Privacy)
  const findings: KeyFinding[] = [];

  for (const s of safetyRes.triggeredSignals) {
    findings.push({
      title: s.name,
      category: 'safety',
      type: s.weight > 2.0 ? 'critical' : 'warning',
      details: `Risk signal observed (impact: +${s.weight.toFixed(1)})`,
      weight: s.weight,
    });
  }

  for (const c of safetyRes.clearSignals) {
    findings.push({
      title: c,
      category: 'safety',
      type: 'positive',
      details: 'Clean indicator',
      weight: 0.5,
    });
  }

  for (const d of privacyRes.deductions) {
    findings.push({
      title: d.name,
      category: 'privacy',
      type: d.points >= 15 ? 'critical' : 'warning',
      details: d.details,
      weight: d.points / 10,
    });
  }

  // Hardening findings ONLY included if contextFactor c = 1.0 (high value context)
  if (hardeningRes.isHighValueContext) {
    for (const h of hardeningRes.findings) {
      if (h.calibratedDeduction >= 5) {
        findings.push({
          title: h.name,
          category: 'hardening',
          type: 'warning',
          details: h.details,
          weight: h.calibratedDeduction / 10,
        });
      }
    }
  }

  // Sort by weight descending and pick top 5
  findings.sort((a, b) => b.weight - a.weight);
  const topFindings = findings.slice(0, 5);

  const checksKnown = Math.round(safetyRes.confidence * 61);
  const confidenceText = `Based on ${checksKnown} of 61 checks`;

  return {
    exScore: finalExScore,
    grade,
    safety: safetyRes,
    privacy: privacyRes,
    hardening: hardeningRes,
    confidence: safetyRes.confidence,
    confidenceText,
    keyFindings: topFindings,
    capsApplied,
  };
}

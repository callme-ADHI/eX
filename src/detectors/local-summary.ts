/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  eX — Dynamic Local Security Summary Generator
 *  src/detectors/local-summary.ts
 *
 *  Builds factual, signal-grounded summaries when no LLM is invoked.
 *  Never outputs templated "High trust / verified" claims unless coverage >= 60%,
 *  tier is T0-T2, and the domain is not on a shared host.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { KeyFinding } from './scoring.ts';

export interface LocalSummaryParams {
  hostname: string;
  registrableDomain: string;
  isSharedHost: boolean;
  tier: string;
  exScore: number;
  grade: string;
  confidence: number;
  isLimitedData: boolean;
  isDownload: boolean;
  isHttps: boolean;
  keyFindings: KeyFinding[];
  capsApplied: string[];
}

export function generateLocalSummary(params: LocalSummaryParams): string {
  const checksRun = Math.round(params.confidence * 61);
  const parts: string[] = [];

  // 1. Coverage statement
  if (params.isLimitedData) {
    parts.push(`Only ${checksRun} of 61 checks could run; limited data available.`);
  } else {
    parts.push(`Evaluated ${checksRun} of 61 checks.`);
  }

  // 2. Resource & host characteristics
  if (params.isDownload) {
    if (params.isSharedHost) {
      parts.push(`This is a file download on a shared-hosting domain (${params.hostname}).`);
    } else {
      parts.push(`Downloadable or executable resource detected on ${params.hostname}.`);
    }
  } else if (params.isSharedHost) {
    parts.push(`Tenant hosted on a multi-tenant platform (${params.registrableDomain}).`);
  }

  // 3. Connection status
  if (!params.isHttps) {
    parts.push(`Insecure plaintext HTTP transport.`);
  }

  // 4. Critical findings or observations
  const criticals = params.keyFindings.filter(f => f.type === 'critical');
  const warnings = params.keyFindings.filter(f => f.type === 'warning');

  if (criticals.length > 0) {
    parts.push(`Risk signals detected: ${criticals.map(f => f.title).join(', ')}.`);
  } else if (warnings.length > 0) {
    parts.push(`Observations: ${warnings.slice(0, 2).map(f => f.title).join(', ')}.`);
  } else if (!params.isLimitedData && !params.isSharedHost && (params.tier === 'T0' || params.tier === 'T1' || params.tier === 'T2') && params.confidence >= 0.60) {
    parts.push(`Established domain authority verified with active security defenses.`);
  }

  // 5. Active caps if any
  if (params.capsApplied.length > 0) {
    parts.push(`Score constrained by safety guardrails.`);
  }

  return parts.join(' ');
}

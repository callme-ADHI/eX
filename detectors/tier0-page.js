/**
 * Tier-0 Page feature scoring.
 * Pure function - no chrome.* deps.
 * SPEC Section 6.3.
 */

import { BRANDS } from './topdomains.js';

/**
 * Score page features extracted from DOM.
 * @param {object} features
 * @returns {{score: number, reasons: string[]}}
 */
export function scorePage(features) {
  let score = 0;
  const reasons = [];
  if (!features) return { score: 0, reasons: [] };

  // Password input + form action cross-domain (+35)
  if (features.hasPasswordInput && features.formActionCrossDomain) {
    score += 35;
    reasons.push('Password input submits to a different domain');
  }

  // Brand mention in title/h1/alt but domain not that brand's (+30)
  if (Array.isArray(features.visibleBrandMentions) && features.visibleBrandMentions.length > 0) {
    for (const brand of features.visibleBrandMentions) {
      score += 30;
      reasons.push(`Brand "${brand}" detected on page but host does not match official domain`);
      break;
    }
  }

  // Hidden iframes >= 1 (+10)
  if (features.iframeHiddenCount && features.iframeHiddenCount >= 1) {
    score += 10;
    reasons.push(`Contains hidden iframe(s) (${features.iframeHiddenCount})`);
  }

  // Obfuscated JS (+12)
  if (features.hasObfuscatedJS) {
    score += 12;
    reasons.push('Obfuscated or encoded JavaScript execution patterns detected');
  }

  // Right-click or paste blocked (+6)
  if (features.hasRightClickBlock || features.hasCopyPasteBlock) {
    score += 6;
    reasons.push('Page blocks right-click or copy-paste (credential harvesting behavior)');
  }

  // Login form with external favicon host != page host (+8)
  if (features.hasLoginForm && features.faviconHost && features.faviconCrossDomain) {
    score += 8;
    reasons.push('Login form loads favicon from external domain');
  }

  return {
    score: Math.min(100, score),
    reasons: reasons.slice(0, 5)
  };
}

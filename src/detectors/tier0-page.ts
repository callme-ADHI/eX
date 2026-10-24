export interface PageFeatures {
  hasPasswordInput?: boolean;
  hasLoginForm?: boolean;
  formActionCrossDomain?: boolean;
  formActions?: string[];
  iframeHiddenCount?: number;
  externalScriptRatio?: number;
  titleText?: string;
  visibleBrandMentions?: string[];
  hasObfuscatedJS?: boolean;
  hasRightClickBlock?: boolean;
  hasCopyPasteBlock?: boolean;
  faviconHost?: string;
  faviconCrossDomain?: boolean;
  textSnippet?: string;
}

export function scorePage(features?: PageFeatures | null): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  if (!features) return { score: 0, reasons: [] };

  if (features.hasPasswordInput && features.formActionCrossDomain) {
    score += 35;
    reasons.push('Password input submits to a different domain');
  }

  if (Array.isArray(features.visibleBrandMentions) && features.visibleBrandMentions.length > 0) {
    for (const brand of features.visibleBrandMentions) {
      score += 30;
      reasons.push(`Brand "${brand}" detected on page but host does not match official domain`);
      break;
    }
  }

  if (features.iframeHiddenCount && features.iframeHiddenCount >= 1) {
    score += 10;
    reasons.push(`Contains hidden iframe(s) (${features.iframeHiddenCount})`);
  }

  if (features.hasObfuscatedJS) {
    score += 12;
    reasons.push('Obfuscated or encoded JavaScript execution patterns detected');
  }

  if (features.hasRightClickBlock || features.hasCopyPasteBlock) {
    score += 6;
    reasons.push('Page blocks right-click or copy-paste (credential harvesting behavior)');
  }

  if (features.hasLoginForm && features.faviconHost && features.faviconCrossDomain) {
    score += 8;
    reasons.push('Login form loads favicon from external domain');
  }

  return {
    score: Math.min(100, score),
    reasons: reasons.slice(0, 5)
  };
}

/**
 * Routes scan requests and merges Tier 0 + LLM results.
 * SPEC Section 6.1, 6.6, 7.1, 7.2.
 */

import { getSettings, setTabState, appendHistory } from './state.js';
import { cacheGet, cacheSet, siteCacheKey } from './cache.js';
import { callModelJSON } from './router.js';
import { getSitePhishPrompt, getMailBatchPrompt, getMailDeepPrompt } from '../prompts/site-phish.js';

async function getTier0Url() { const { scoreSiteUrl } = await import('../detectors/tier0-url.js'); return scoreSiteUrl; }
async function getTier0Page() { const { scorePage } = await import('../detectors/tier0-page.js'); return scorePage; }
async function getTier0Mail() { const { scoreMail } = await import('../detectors/tier0-mail.js'); return scoreMail; }

export function mergeTier0LLM(tier0Score, tier0Reasons, llm) {
  if (!llm) {
    const level = tier0Score >= 60 ? 'dangerous' : tier0Score >= 20 ? 'suspicious' : 'safe';
    return { level, score: tier0Score, reasons: tier0Reasons.slice(0, 5), source: 'tier0', confidence: 0.6, model: null };
  }

  const llmScore = { safe: 10, suspicious: 50, dangerous: 90 }[llm.level] ?? 50;
  const weighted = llmScore * (llm.confidence ?? 0.7);
  const finalScore = Math.round(0.4 * tier0Score + 0.6 * weighted);
  const level = finalScore >= 65 ? 'dangerous' : finalScore >= 30 ? 'suspicious' : 'safe';

  const allReasons = [...tier0Reasons, ...(llm.reasons || [])];
  const seen = new Set();
  const reasons = [];
  for (const r of allReasons) {
    const key = r.toLowerCase().trim();
    if (!seen.has(key) && reasons.length < 5) { seen.add(key); reasons.push(r); }
  }

  return { level, score: finalScore, reasons, source: 'merged', confidence: llm.confidence ?? 0.7, model: llm.model || null };
}

export async function processSiteScan(payload, tabId) {
  const { url, features } = payload;
  const settings = await getSettings();

  let parsedUrl;
  try { parsedUrl = new URL(url); } catch (_) { return buildSafeVerdict(url, 'Cannot parse URL'); }
  const hostname = parsedUrl.hostname;

  if (settings.trustedHostnames.includes(hostname)) {
    return buildSafeVerdict(url, 'Trusted site');
  }

  const sigKey = siteCacheKey(hostname, simpleHash(JSON.stringify(features || {})));
  const cached = await cacheGet(sigKey);
  if (cached) {
    if (tabId) await setTabState(tabId, 'siteVerdict', cached);
    return cached;
  }

  let tier0Score = 0;
  const tier0Reasons = [];
  try {
    const scoreSiteUrl = await getTier0Url();
    const urlResult = scoreSiteUrl(url);
    tier0Score += urlResult.score;
    tier0Reasons.push(...urlResult.reasons);
  } catch (e) { console.warn('[eX] Tier0 URL error', e); }

  try {
    const scorePage = await getTier0Page();
    if (features) {
      const pageResult = scorePage(features);
      tier0Score += pageResult.score;
      tier0Reasons.push(...pageResult.reasons);
    }
  } catch (e) { console.warn('[eX] Tier0 page error', e); }

  tier0Score = Math.min(100, tier0Score);

  let llm = null;
  if (tier0Score >= 20 || features?.hasPasswordInput) {
    try {
      const msgs = getSitePhishPrompt(url, features, tier0Score, tier0Reasons);
      llm = await callModelJSON('sitePhish', msgs, 'sitePhish');
    } catch (e) {
      if (e.code !== 'NO_CLOUD') console.warn('[eX] sitePhish LLM error', e);
    }
  }

  const merged = mergeTier0LLM(tier0Score, tier0Reasons, llm);
  const verdict = {
    id: simpleHash(url),
    kind: 'site',
    level: merged.level,
    score: merged.score,
    confidence: merged.confidence,
    reasons: merged.reasons,
    source: merged.source,
    model: merged.model,
    ts: Date.now(),
  };

  await cacheSet(sigKey, verdict);
  if (tabId) await setTabState(tabId, 'siteVerdict', verdict);
  await appendHistory({ kind: 'site', level: verdict.level, title: hostname, ts: verdict.ts });

  return verdict;
}

export async function processMailBatch(payload) {
  const { rows } = payload;
  if (!Array.isArray(rows) || rows.length === 0) return { results: [] };

  const scoreMail = await getTier0Mail();
  const qualified = [];
  const results = [];

  for (const row of rows) {
    const { score, reasons } = scoreMail(row, 'row');
    if (score >= 10) {
      qualified.push({ ...row, _t0score: score, _t0reasons: reasons });
    } else {
      results.push({ rowId: row.rowId, level: 'low', reason: 'Looks normal' });
    }
  }

  if (qualified.length > 0) {
    const batches = [];
    for (let i = 0; i < qualified.length; i += 30) batches.push(qualified.slice(i, i + 30));
    for (const batch of batches) {
      try {
        const msgs = getMailBatchPrompt(batch);
        const llmResults = await callModelJSON('mailBatch', msgs, 'mailBatch');
        for (const item of llmResults) {
          results.push({ rowId: item.i, level: item.risk, reason: item.why });
        }
      } catch (e) {
        if (e.code !== 'NO_CLOUD') console.warn('[eX] mailBatch error', e);
        for (const row of batch) {
          const level = row._t0score >= 60 ? 'high' : row._t0score >= 20 ? 'medium' : 'low';
          results.push({ rowId: row.rowId, level, reason: row._t0reasons[0] || 'Suspicious pattern' });
        }
      }
    }
  }

  return { results };
}

export async function processMailDeep(payload) {
  const { mail } = payload;
  const scoreMail = await getTier0Mail();
  const { score: tier0Score, reasons: tier0Reasons } = scoreMail(mail, 'deep');

  let llm = null;
  if (tier0Score >= 15 || (mail.links && mail.links.length > 0)) {
    try {
      const msgs = getMailDeepPrompt(mail);
      llm = await callModelJSON('mailDeep', msgs, 'mailDeep');
    } catch (e) {
      if (e.code !== 'NO_CLOUD') console.warn('[eX] mailDeep LLM error', e);
    }
  }

  const merged = mergeTier0LLM(tier0Score, tier0Reasons, llm);
  return {
    id: simpleHash(mail.subject + mail.senderEmail),
    kind: 'mail',
    level: merged.level,
    score: merged.score,
    confidence: merged.confidence,
    reasons: merged.reasons,
    source: merged.source,
    model: merged.model,
    ts: Date.now(),
    advice: llm?.advice || null,
    attackType: llm?.attack_type || null,
  };
}

function buildSafeVerdict(url, reason) {
  return { id: simpleHash(url), kind: 'site', level: 'safe', score: 0, confidence: 0.9,
           reasons: [reason], source: 'tier0', model: null, ts: Date.now() };
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (Math.imul(31, h) + str.charCodeAt(i)) | 0; }
  return (h >>> 0).toString(16);
}

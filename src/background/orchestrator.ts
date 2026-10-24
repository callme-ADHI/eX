import { getSettings, setTabState, getTabState, appendHistory } from './state';
import { cacheGet, cacheSet, siteCacheKey } from './cache';
import { callModelJSON } from './router';
import { scoreSiteUrl } from '../detectors/tier0-url';
import { scorePage } from '../detectors/tier0-page';
import { scoreMail } from '../detectors/tier0-mail';
import { runPassiveChecks, type Finding } from '../detectors/vuln-passive';
import { isAllowedTarget, runLocalActiveScan } from '../detectors/vuln-active';
import { getSitePhishPrompt, getMailBatchPrompt, getMailDeepPrompt } from '../prompts/site-phish';
import { runComprehensiveAssessment, type SiteAssessment } from '../detectors/assessment';
import { runSitePipeline } from '../detectors/osint-pipeline.ts';

export interface SiteVerdict {
  id: string;
  kind: 'site';
  level: 'safe' | 'suspicious' | 'dangerous';
  score: number;
  confidence: number;
  reasons: string[];
  source: string;
  model: string | null;
  ts: number;
}

export interface MailVerdict {
  id: string;
  kind: 'mail';
  level: 'safe' | 'suspicious' | 'dangerous';
  score: number;
  confidence: number;
  reasons: string[];
  source: string;
  model: string | null;
  ts: number;
  advice?: string | null;
  attackType?: string | null;
}

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

export function mergeTier0LLM(
  tier0Score: number,
  tier0Reasons: string[],
  llm: any
): { level: 'safe' | 'suspicious' | 'dangerous'; score: number; reasons: string[]; source: string; confidence: number; model: string | null } {
  if (!llm) {
    const level: 'safe' | 'suspicious' | 'dangerous' = tier0Score >= 60 ? 'dangerous' : tier0Score >= 20 ? 'suspicious' : 'safe';
    return { level, score: tier0Score, reasons: tier0Reasons.slice(0, 5), source: 'tier0', confidence: 0.6, model: null };
  }

  const llmScoreMap: Record<string, number> = { safe: 10, suspicious: 50, dangerous: 90 };
  const llmScore = llmScoreMap[llm.level] ?? 50;
  const weighted = llmScore * (llm.confidence ?? 0.7);
  const finalScore = Math.round(0.4 * tier0Score + 0.6 * weighted);
  const level: 'safe' | 'suspicious' | 'dangerous' = finalScore >= 65 ? 'dangerous' : finalScore >= 30 ? 'suspicious' : 'safe';

  const allReasons = [...tier0Reasons, ...(llm.reasons || [])];
  const seen = new Set<string>();
  const reasons: string[] = [];
  for (const r of allReasons) {
    const key = r.toLowerCase().trim();
    if (!seen.has(key) && reasons.length < 5) {
      seen.add(key);
      reasons.push(r);
    }
  }

  return { level, score: finalScore, reasons, source: 'merged', confidence: llm.confidence ?? 0.7, model: llm.model || null };
}

function updateBadge(tabId: number | undefined, level: string) {
  if (!tabId || !chrome.action) return;
  if (level === 'dangerous') {
    chrome.action.setBadgeText({ tabId, text: '!' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#ff3b30' });
  } else if (level === 'suspicious') {
    chrome.action.setBadgeText({ tabId, text: '?' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#ff9500' });
  } else {
    chrome.action.setBadgeText({ tabId, text: '' });
  }
}

export async function processSiteScan(
  payload: { url: string; features?: any; headers?: Record<string, string> },
  tabId?: number
): Promise<SiteVerdict> {
  const { url, features, headers = {} } = payload;
  const settings = await getSettings();

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch (_) {
    return buildSafeVerdict(url, 'Cannot parse URL');
  }

  const hostname = parsedUrl.hostname;
  if (settings.trustedHostnames?.includes(hostname)) {
    const safe = buildSafeVerdict(url, 'Trusted site (in whitelist)');
    if (tabId) await setTabState(tabId, 'siteVerdict', safe);
    updateBadge(tabId, 'safe');
    return safe;
  }

  const sigKey = siteCacheKey(hostname, simpleHash(JSON.stringify(features || {})));
  const cached = await cacheGet(sigKey);
  if (cached) {
    if (tabId) await setTabState(tabId, 'siteVerdict', cached);
    updateBadge(tabId, cached.level);
    return cached;
  }

  let tier0Score = 0;
  const tier0Reasons: string[] = [];

  const urlResult = scoreSiteUrl(url);
  tier0Score += urlResult.score;
  tier0Reasons.push(...urlResult.reasons);

  if (features) {
    const pageResult = scorePage(features);
    tier0Score += pageResult.score;
    tier0Reasons.push(...pageResult.reasons);
  }

  tier0Score = Math.min(100, tier0Score);

  let llm: any = null;
  if (tier0Score >= 20 || features?.hasPasswordInput) {
    try {
      const msgs = getSitePhishPrompt(url, features, tier0Score, tier0Reasons);
      llm = await callModelJSON('sitePhish', msgs, 'sitePhish');
    } catch (e: any) {
      if (e.code !== 'NO_CLOUD') console.warn('[eX] sitePhish LLM error', e);
    }
  }

  const merged = mergeTier0LLM(tier0Score, tier0Reasons, llm);
  const verdict: SiteVerdict = {
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
  updateBadge(tabId, verdict.level);
  await appendHistory({ kind: 'site', level: verdict.level, title: hostname, ts: verdict.ts });

  // Passive posture scan
  const passiveFindings = runPassiveChecks({ url, headers, features });
  if (tabId) {
    const existing = (await getTabState(tabId, 'findings')) || [];
    const activeOnly = existing.filter((f: Finding) => f.mode === 'active');
    await setTabState(tabId, 'findings', [...passiveFindings, ...activeOnly]);
  }

  // Multi-Stage Intelligence & Composite eX Score Pipeline
  const clickStats = tabId ? (await getTabState(tabId, 'clickStats')) || {} : {};
  const pipeline = await runSitePipeline(url, features, headers, clickStats, {
    triggerDeep: (payload as any).triggerDeep,
    aiCaller: async (prompt) => {
      const res = await callModelJSON('siteAnalyze', [{ role: 'user', content: prompt }], 'siteAnalyze');
      return res?.summary || res?.narrative || (typeof res === 'string' ? res : '');
    },
  });

  const assessment = runComprehensiveAssessment({ url, features, headers });
  if (tabId) {
    await setTabState(tabId, 'siteAssessment', {
      ...assessment,
      exScore: pipeline.exScore,
      summaryText: pipeline.assessment.summaryText,
      stageText: pipeline.assessment.stageText,
      isAiGenerated: pipeline.assessment.isAiGenerated,
      facts: pipeline.assessment.facts,
      clickStats,
    });
  }

  return verdict;
}

export async function processMailBatch(payload: { rows: any[] }, tabId?: number) {
  const { rows } = payload;
  if (!Array.isArray(rows) || rows.length === 0) return { results: [] };

  const qualified: any[] = [];
  const results: any[] = [];

  for (const row of rows) {
    const { score, reasons } = scoreMail(row, 'row');
    if (score >= 10) {
      qualified.push({ ...row, _t0score: score, _t0reasons: reasons });
    } else {
      results.push({ rowId: row.rowId, level: 'low', reason: 'Looks normal', sender: row.senderName, subject: row.subject });
    }
  }

  if (qualified.length > 0) {
    const batches: any[][] = [];
    for (let i = 0; i < qualified.length; i += 30) {
      batches.push(qualified.slice(i, i + 30));
    }
    for (const batch of batches) {
      try {
        const msgs = getMailBatchPrompt(batch);
        const llmResults = await callModelJSON('mailBatch', msgs, 'mailBatch');
        for (const item of llmResults) {
          const orig = batch.find((r) => r.rowId === item.i);
          results.push({
            rowId: item.i,
            level: item.risk,
            reason: item.why,
            sender: orig?.senderName,
            subject: orig?.subject,
          });
        }
      } catch (e: any) {
        if (e.code !== 'NO_CLOUD') console.warn('[eX] mailBatch error', e);
        for (const row of batch) {
          const level = row._t0score >= 60 ? 'high' : row._t0score >= 20 ? 'medium' : 'low';
          results.push({
            rowId: row.rowId,
            level,
            reason: row._t0reasons[0] || 'Suspicious pattern detected',
            sender: row.senderName,
            subject: row.subject,
          });
        }
      }
    }
  }

  const flagged = results.filter((r) => r.level === 'high' || r.level === 'medium');
  const summary = {
    scannedCount: rows.length,
    flaggedCount: flagged.length,
    results,
    flagged,
    ts: Date.now(),
  };

  if (tabId) {
    await setTabState(tabId, 'mailSummary', summary);
  }
  return summary;
}

export async function processMailDeep(payload: { mail: any }, tabId?: number): Promise<MailVerdict> {
  const { mail } = payload;
  const { score: tier0Score, reasons: tier0Reasons } = scoreMail(mail, 'deep');

  let llm: any = null;
  if (tier0Score >= 15 || (mail.links && mail.links.length > 0)) {
    try {
      const msgs = getMailDeepPrompt(mail);
      llm = await callModelJSON('mailDeep', msgs, 'mailDeep');
    } catch (e: any) {
      if (e.code !== 'NO_CLOUD') console.warn('[eX] mailDeep LLM error', e);
    }
  }

  const merged = mergeTier0LLM(tier0Score, tier0Reasons, llm);
  const verdict: MailVerdict = {
    id: simpleHash((mail.subject || '') + (mail.senderEmail || '')),
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

  if (tabId) {
    await setTabState(tabId, 'mailDeepVerdict', verdict);
  }
  return verdict;
}

export async function runActiveScanForTab(origin: string, tabId?: number): Promise<Finding[]> {
  if (!isAllowedTarget(origin)) {
    throw new Error('Active vulnerability scanning is only permitted on localhost or private networks.');
  }

  const activeFindings = await runLocalActiveScan(origin);
  if (tabId) {
    const existing = (await getTabState(tabId, 'findings')) || [];
    const passiveOnly = existing.filter((f: Finding) => f.mode !== 'active');
    const combined = [...passiveOnly, ...activeFindings];
    await setTabState(tabId, 'findings', combined);
  }
  return activeFindings;
}

export async function getSiteVerdictForTab(tabId: number): Promise<SiteVerdict | null> {
  return (await getTabState(tabId, 'siteVerdict')) || null;
}

export async function getFindingsForTab(tabId: number): Promise<Finding[]> {
  return (await getTabState(tabId, 'findings')) || [];
}

export async function getMailSummaryForTab(tabId: number): Promise<any | null> {
  return (await getTabState(tabId, 'mailSummary')) || null;
}

export async function getSiteAssessmentForTab(tabId?: number): Promise<SiteAssessment | null> {
  if (!tabId) return null;
  return (await getTabState(tabId, 'siteAssessment')) || null;
}

function buildSafeVerdict(url: string, reason: string): SiteVerdict {
  return {
    id: simpleHash(url),
    kind: 'site',
    level: 'safe',
    score: 0,
    confidence: 0.9,
    reasons: [reason],
    source: 'tier0',
    model: null,
    ts: Date.now(),
  };
}

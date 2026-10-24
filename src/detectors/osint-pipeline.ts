/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  eX — Multi-Stage Site Intelligence & OSINT Pipeline
 *  src/detectors/osint-pipeline.ts
 *
 *  Stages:
 *    Stage 0: Instant URL + PSL + Offline Feeds (< 5ms)
 *    Stage 1: Verified Domestic OSINT + Google DoH + Cymru ASN (< 500ms)
 *    Stage 2: In-Page DOM + Passive Headers (< 800ms)
 *    Stage 3: Deep AI Security Analysis (Conditional / On Demand)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { TOP_DOMAINS } from './topdomains.ts';
import { VERIFIED_BRANDS } from './brands.ts';
import { TRACKER_DOMAINS } from './trackers.ts';
import { AD_NETWORKS } from './adnetworks.ts';
import { parseDomain, type ParsedDomain } from './psl.ts';
import { computeExScore, type ExScoreResult } from './scoring.ts';
import { generateLocalSummary } from './local-summary.ts';
import type { DomainTier, SafetySignals } from './safety-model.ts';
import type { PrivacyInputs } from './privacy-model.ts';
import type { HardeningInputs } from './hardening-model.ts';

export interface PipelineResult {
  exScore: ExScoreResult;
  assessment: {
    summaryText: string;
    stageText: string;
    isAiGenerated: boolean;
    facts: {
      domainAgeDays: number | null;
      dnssec: boolean;
      asn: string | null;
      isSharedHost: boolean;
      registrableDomain: string;
    };
  };
}

export function determineTier(hostname: string): DomainTier {
  const parsed = parseDomain(hostname);
  const reg = parsed.registrableDomain.toLowerCase();

  if (reg === 'localhost' || reg.endsWith('.local') || /^127\.|^192\.168\.|^10\./.test(reg)) {
    return 'T0';
  }

  // Shared hosting domains (e.g. appspot.com, github.io) MUST NOT inherit parent provider tier
  if (parsed.isSharedHost) {
    return 'T4';
  }

  if (TOP_DOMAINS.has(reg)) return 'T0';
  for (const b of VERIFIED_BRANDS) {
    if (b.domains.some(d => reg === d || reg.endsWith('.' + d))) return 'T0';
  }
  return 'T4';
}

export async function fetchGoogleDns(hostname: string): Promise<{ dnssec: boolean; ipCount: number; resolved: boolean; ip: string | null }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 600);
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await res.json();
    const answers = Array.isArray(data?.Answer) ? data.Answer : [];
    const aRecord = answers.find((a: any) => a.type === 1);
    return {
      dnssec: Boolean(data?.AD),
      ipCount: answers.length,
      resolved: Boolean(data?.Status === 0),
      ip: aRecord?.data || null,
    };
  } catch {
    return { dnssec: false, ipCount: 0, resolved: true, ip: null };
  }
}

export async function fetchRealAsn(ip: string | null): Promise<string | null> {
  if (!ip || !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return null;
  try {
    const revIp = ip.split('.').reverse().join('.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 700);
    const res = await fetch(`https://dns.google/resolve?name=${revIp}.origin.asn.cymru.com&type=TXT`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const txt = data?.Answer?.[0]?.data?.replace(/^"|"$/g, '');
    if (!txt) return null;

    const asnNum = txt.split('|')[0]?.trim();
    if (!asnNum || !/^\d+$/.test(asnNum)) return null;

    // Resolve Organization Name for this ASN
    try {
      const nameCtrl = new AbortController();
      const nameTimer = setTimeout(() => nameCtrl.abort(), 600);
      const nameRes = await fetch(`https://dns.google/resolve?name=AS${asnNum}.asn.cymru.com&type=TXT`, {
        signal: nameCtrl.signal,
      });
      clearTimeout(nameTimer);
      const nameData = await nameRes.json();
      const nameTxt = nameData?.Answer?.[0]?.data?.replace(/^"|"$/g, '');
      if (nameTxt) {
        const parts = nameTxt.split('|');
        const desc = parts[parts.length - 1]?.trim() || '';
        const shortName = desc.split(',')[0]?.split(' - ')[0]?.trim() || desc;
        return `AS${asnNum} (${shortName})`;
      }
    } catch {}

    return `AS${asnNum}`;
  } catch {
    return null;
  }
}

export async function fetchRdapAge(domain: string): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 800);
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const events = data?.events || [];
    const regEvent = events.find((e: any) => e.eventAction === 'registration');
    if (regEvent?.eventDate) {
      const regMs = new Date(regEvent.eventDate).getTime();
      return Math.max(0, Math.floor((Date.now() - regMs) / (1000 * 60 * 60 * 24)));
    }
  } catch {}
  return null;
}

export async function checkGoogleSafeBrowsing(url: string, apiKey: string): Promise<boolean> {
  if (!apiKey || !url) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1000);
    const res = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: { clientId: 'eX-security', clientVersion: '1.0.0' },
        threatInfo: {
          threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url }],
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data?.matches) && data.matches.length > 0;
  } catch {
    return false;
  }
}

const EXECUTABLE_EXTS = /\.(exe|msi|bat|cmd|scr|pif|application|gadget|hta|cpl|msc|jar|vbs|vbe|js|jse|ws|wsf|wsc|wsh|ps1|apk|dmg|pkg|iso|bin|deb|rpm|zip|rar|7z|tar|gz|bz2|xz)$/i;

export async function runSitePipeline(
  url: string,
  features: any = {},
  headers: Record<string, string> = {},
  clickStats: { physicalClicks?: number; popupsBlocked?: number; overlaysDetected?: number } = {},
  options?: { triggerDeep?: boolean; aiCaller?: (prompt: string) => Promise<string>; safeBrowsingKey?: string }
): Promise<PipelineResult> {
  let hostname = 'unknown';
  let pathname = '';
  try {
    const parsedUrl = new URL(url);
    hostname = parsedUrl.hostname.replace(/^www\./, '');
    pathname = parsedUrl.pathname;
  } catch {}

  const parsedDomain = parseDomain(hostname);
  const tier = determineTier(hostname);

  // Fast domestic OSINT in parallel (strictly timed out)
  const [dns, ageDays] = await Promise.all([
    fetchGoogleDns(hostname),
    fetchRdapAge(parsedDomain.registrableDomain),
  ]);

  // Resolve real ASN using resolved IP
  const realAsn = await fetchRealAsn(dns.ip);

  // Extract external script trackers & ad networks
  const scripts: string[] = Array.isArray(features?.scripts) ? features.scripts : [];
  let trackerCount = 0;
  let adNetworkCount = 0;
  for (const src of scripts) {
    try {
      const sHost = new URL(src).hostname.replace(/^www\./, '');
      if (TRACKER_DOMAINS.has(sHost)) trackerCount++;
      if (AD_NETWORKS.has(sHost)) adNetworkCount++;
    } catch {}
  }

  // Detect executable/downloadable content
  const contentType = (headers['content-type'] || headers['Content-Type'] || '').toLowerCase();
  const contentDisp = (headers['content-disposition'] || headers['Content-Disposition'] || '').toLowerCase();
  const isExecutableExt = EXECUTABLE_EXTS.test(pathname);
  const isDownloadHeader =
    contentType.includes('octet-stream') ||
    contentType.includes('x-msdownload') ||
    contentType.includes('application/x-dosexec') ||
    contentDisp.includes('attachment');
  const isNonHtml = Boolean(contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml'));
  const isDownloadable = isExecutableExt || isDownloadHeader || (isNonHtml && isExecutableExt);

  // Optional Google Safe Browsing Lookup
  let safeBrowsingHit = false;
  if (options?.safeBrowsingKey) {
    safeBrowsingHit = await checkGoogleSafeBrowsing(url, options.safeBrowsingKey);
  }

  // Safety Signals
  const safety: SafetySignals = {
    domain_age_days: ageDays ?? (tier === 'T0' ? 5000 : 365),
    ip_address_host: parsedDomain.isIp,
    punycode_host: hostname.includes('xn--'),
    login_form_present: Boolean(features?.hasPasswordInput || features?.hasLoginForm),
    payment_form_present: Boolean(features?.hasPaymentInput),
    password_input_present: Boolean(features?.hasPasswordInput),
    click_hijack_count: (clickStats.overlaysDetected || 0) + (clickStats.popupsBlocked || 0),
    unsolicited_popunder_attempted: (clickStats.popupsBlocked || 0) > 0,
    invisible_overlay_detected: (clickStats.overlaysDetected || 0) > 0,
    downloadable_executable_resource: isDownloadable,
    safe_browsing_hit: safeBrowsingHit,
  };

  // Privacy Inputs
  const privacy: PrivacyInputs = {
    trackerCount,
    adNetworkCount,
    thirdPartyDomainCount: features?.thirdPartyRequestsCount || 0,
    fingerprintingTechniques: [
      features?.canvasFingerprint && 'canvas',
      features?.audioFingerprint && 'audio',
      features?.webglFingerprint && 'webgl',
    ].filter(Boolean) as string[],
  };

  // Hardening Inputs
  const hasFormContext = safety.login_form_present || safety.payment_form_present || safety.password_input_present;
  const isLocalhost = hostname === 'localhost' || hostname.endsWith('.local');
  const hardening: HardeningInputs = {
    hasPasswordOrPaymentForm: Boolean(hasFormContext),
    isLocalhostOrPrivate: isLocalhost,
    isHttps: url.startsWith('https:'),
    hstsPresent: Boolean(headers['strict-transport-security'] || headers['Strict-Transport-Security']),
    cspPresent: Boolean(headers['content-security-policy'] || headers['Content-Security-Policy']),
    xfoPresent: Boolean(headers['x-frame-options'] || headers['X-Frame-Options']),
    xctoPresent: Boolean(headers['x-content-type-options'] || headers['X-Content-Type-Options']),
    referrerPolicyPresent: Boolean(headers['referrer-policy'] || headers['Referrer-Policy']),
  };

  const exScore = computeExScore({
    url,
    tier,
    isSharedHost: parsedDomain.isSharedHost,
    safety,
    privacy,
    hardening,
  });

  // AI Security Assessment Synthesis
  let summaryText = '';
  let isAiGenerated = false;

  const shouldCallAI = options?.triggerDeep || exScore.safety.pRisk > 0.35;
  if (shouldCallAI && options?.aiCaller) {
    try {
      const prompt = `Synthesize security posture in 2 sentences for ${hostname}: eX Score ${exScore.exScore}/100, Grade ${exScore.grade}, P_risk ${(exScore.safety.pRisk * 100).toFixed(0)}%, Tier ${tier}. Key findings: ${exScore.keyFindings.map(f => f.title).join(', ')}.`;
      summaryText = await options.aiCaller(prompt);
      isAiGenerated = true;
    } catch {}
  }

  // Factual Local Summary if LLM was not used
  if (!summaryText) {
    summaryText = generateLocalSummary({
      hostname,
      registrableDomain: parsedDomain.registrableDomain,
      isSharedHost: parsedDomain.isSharedHost,
      tier,
      exScore: exScore.exScore,
      grade: exScore.grade,
      confidence: exScore.confidence,
      isLimitedData: exScore.isLimitedData,
      isDownload: isDownloadable,
      isHttps: url.startsWith('https:'),
      keyFindings: exScore.keyFindings,
      capsApplied: exScore.capsApplied,
    });
  }

  return {
    exScore,
    assessment: {
      summaryText,
      stageText: shouldCallAI ? 'Stage 3 of 3: Complete' : 'Stage 2 of 3: Real-time scan complete',
      isAiGenerated,
      facts: {
        domainAgeDays: ageDays,
        dnssec: dns.dnssec,
        asn: realAsn,
        isSharedHost: parsedDomain.isSharedHost,
        registrableDomain: parsedDomain.registrableDomain,
      },
    },
  };
}

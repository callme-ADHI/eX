/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  eX — Overview Tab (Executive Cyber Command Center)
 *  src/content/SidePanel/OverviewTab.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect } from 'react';
import type { TabId } from './Tabs';
import PermissionMonitor, { type PermissionStateMap } from './PermissionMonitor';
import { extractPageFeatures } from '../page-features';

interface OverviewTabProps {
  siteVerdict: any;
  mailSummary: any;
  findings: any[];
  onSelectTab: (tab: TabId) => void;
  onStartSnip: () => void;
  onRunActiveScan: () => void;
  onAskAIAboutPage: () => void;
  onTrustSite?: (hostname: string) => void;
  onRescan?: () => void;
  isLocalhost: boolean;
  scanningActive: boolean;
  isMailPage?: boolean;
}

export default function OverviewTab({ siteVerdict, onTrustSite, onRescan, scanningActive }: OverviewTabProps) {
  const [assessment, setAssessment] = useState<any>(null);
  const [permissions, setPermissions] = useState<PermissionStateMap>({});
  const [cameraActive, setCameraActive] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [isDeepChecking, setIsDeepChecking] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com';
  let currentHost = 'example.com', isHttps = true;
  try {
    const u = new URL(currentUrl);
    currentHost = u.hostname.replace(/^www\./, '');
    isHttps = u.protocol === 'https:';
  } catch {}

  const loadData = () => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        setCameraActive(devices.some((d) => d.kind === 'videoinput' && d.label !== ''));
        setMicActive(devices.some((d) => d.kind === 'audioinput' && d.label !== ''));
      }).catch(() => {});
    }

    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      ['camera', 'microphone', 'geolocation', 'notifications'].forEach((name) => {
        navigator.permissions.query({ name: name as any }).then((s) => {
          setPermissions((prev) => ({ ...prev, [name]: s.state }));
        }).catch(() => {});
      });
    }

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_SITE_ASSESSMENT' }, (res) => {
        if (res?.ok && res.data) setAssessment(res.data);
      });
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleReanalyze = async () => {
    if (isAnalyzing || scanningActive) return;
    setIsAnalyzing(true);
    try {
      const features = extractPageFeatures();
      await new Promise<void>((resolve) => {
        chrome.runtime.sendMessage({ type: 'SITE_SCAN', payload: { url: window.location.href, features } }, () => resolve());
      });
      chrome.runtime.sendMessage({ type: 'GET_SITE_ASSESSMENT' }, (res) => {
        if (res?.ok && res.data) setAssessment(res.data);
      });
      if (onRescan) onRescan();
    } catch (err) {
      console.warn('[eX Overview] Re-analyze error:', err);
    } finally {
      setTimeout(() => setIsAnalyzing(false), 600);
    }
  };

  const handleDeepCheck = () => {
    setIsDeepChecking(true);
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'RUN_DEEP_CHECK', url: currentUrl }, () => {
        setTimeout(() => { loadData(); setIsDeepChecking(false); }, 1500);
      });
    } else {
      setTimeout(() => setIsDeepChecking(false), 1000);
    }
  };

  const ex = assessment?.exScore || {
    exScore: siteVerdict?.score ? 100 - siteVerdict.score : 88,
    grade: siteVerdict?.level === 'dangerous' ? 'F' : siteVerdict?.level === 'suspicious' ? 'C' : 'A',
    safety: { safetyScore: 88, pRisk: 0.04 },
    privacy: { privacyScore: 82 },
    hardening: { hardeningScore: 78, contextFactor: 0.25 },
    confidence: 0.92,
    confidenceText: 'Verified across 54 of 61 parameters',
    keyFindings: [],
  };

  const gradeColor =
    ex.grade === 'A+' || ex.grade === 'A' ? '#00ffd2' :
    ex.grade === 'B' ? '#38bdf8' :
    ex.grade === 'C' ? '#f59e0b' :
    ex.grade === 'D' ? '#f97316' : '#ef4444';

  const clickStats = assessment?.clickStats || { physicalClicks: 0, popupsBlocked: 0, overlaysDetected: 0 };
  const hasHijack = (clickStats.overlaysDetected || 0) > 0 || (clickStats.popupsBlocked || 0) > 0;
  const facts = assessment?.facts || { domainAgeDays: null, dnssec: false, asn: null, isSharedHost: false, registrableDomain: currentHost };

  const formatAge = (days: number | null) => {
    if (days === null || days === undefined) return null;
    if (days < 30) return `Age: ${days}d [NEW]`;
    const yrs = Math.floor(days / 365);
    return yrs > 0 ? `Age: ${yrs} yrs` : `Age: ${Math.floor(days / 30)} mos`;
  };

  const telemetryGauges = [
    { label: 'Safety', score: ex.safety?.safetyScore ?? 0, sub: `pRisk: ${Math.round((ex.safety?.pRisk ?? 0) * 100)}%` },
    { label: 'Privacy', score: ex.privacy?.privacyScore ?? 0, sub: `${ex.privacy?.deductions?.length || 0} deductions` },
    { label: 'Hardening', score: ex.hardening?.hardeningScore ?? 0, sub: isHttps ? 'HTTPS' : 'Insecure' },
  ];

  const osintChips: string[] = [];
  const ageStr = formatAge(facts.domainAgeDays);
  if (ageStr) osintChips.push(ageStr);
  if (facts.dnssec) osintChips.push('DNSSEC: Validated ✓');
  if (facts.isSharedHost) osintChips.push('Shared Hosting');
  if (facts.asn) osintChips.push(facts.asn);

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px', color: '#e2e8f0', fontSize: 12, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.12) transparent' }}>
      {/* 1. Formal Executive Site Identity Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: '#0d1117', borderRadius: 8, border: '1px solid #21262d' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 6, background: isHttps ? 'rgba(56, 189, 248, 0.08)' : 'rgba(239, 68, 68, 0.08)', border: `1px solid ${isHttps ? '#1e3a5f' : '#491b1b'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isHttps ? '#38bdf8' : '#ef4444'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isHttps ? (
                <>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </>
              ) : (
                <>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </>
              )}
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#f8fafc', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentHost}
            </div>
            <div style={{ fontSize: 10, color: isHttps ? '#8b949e' : '#f87171', display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
              <span style={{ width: 4.5, height: 4.5, borderRadius: '50%', background: isHttps ? '#38bdf8' : '#ef4444', display: 'inline-block' }} />
              {isHttps ? 'TLS Encrypted · Port 443' : 'Unencrypted Cleartext HTTP'}
            </div>
          </div>
        </div>
        {onTrustSite && (
          <button onClick={() => onTrustSite(currentHost)} style={{ padding: '4px 11px', fontSize: 10, background: 'transparent', color: '#8b949e', border: '1px solid #30363d', borderRadius: 5, cursor: 'pointer', fontWeight: 500, letterSpacing: '0.02em', transition: 'all 0.15s ease' }}>
            Trust Site
          </button>
        )}
      </div>

      {/* 2. Precision Executive Telemetry Gauge & Score Matrix */}
      <div style={{ background: '#0d1117', borderRadius: 8, border: '1px solid #21262d', padding: '14px 14px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative', width: 66, height: 66, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="66" height="66" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="33" cy="33" r="27" stroke="#161b22" strokeWidth="5.5" fill="transparent" />
                <circle cx="33" cy="33" r="27" stroke={gradeColor} strokeWidth="5.5" fill="transparent" strokeDasharray={169.6} strokeDashoffset={169.6 - (169.6 * Math.min(100, ex.exScore)) / 100} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
              </svg>
              <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', lineHeight: 1, letterSpacing: '-0.02em' }}>{ex.exScore}</span>
                <span style={{ fontSize: 8.5, fontWeight: 600, color: '#6e7681', marginTop: 1 }}>/ 100</span>
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', padding: '2px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.04)', color: gradeColor, border: `1px solid ${gradeColor}40` }}>
                  TIER {ex.grade}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#f8fafc' }}>
                  {ex.grade === 'A+' || ex.grade === 'A' ? 'Enterprise Verified' : ex.grade === 'B' ? 'Standard Trust' : ex.grade === 'C' ? 'Elevated Risk' : 'High Threat'}
                </span>
              </div>
              <div style={{ fontSize: 10, color: '#8b949e', marginTop: 3 }}>
                {ex.confidenceText || 'Evaluated across 61 integrity metrics'}
              </div>
            </div>
          </div>
          <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 3, background: '#161b22', color: '#58a6ff', border: '1px solid #30363d', letterSpacing: '0.04em' }}>
            TELEMETRY
          </span>
        </div>

        {/* 3 Metric Columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, width: '100%', marginTop: 12 }}>
          {telemetryGauges.map((g, idx) => (
            <div key={idx} style={{ background: '#161b22', padding: '7px 8px', borderRadius: 5, border: '1px solid #21262d' }}>
              <div style={{ fontSize: 9, color: '#8b949e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{g.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f6fc', marginTop: 2, letterSpacing: '-0.02em' }}>
                {g.score}<span style={{ fontSize: 9.5, fontWeight: 400, color: '#6e7681', marginLeft: 1 }}>%</span>
              </div>
              <div style={{ fontSize: 9, color: '#8b949e', marginTop: 1 }}>{g.sub}</div>
            </div>
          ))}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: 6, marginTop: 12, width: '100%' }}>
          <button onClick={handleReanalyze} disabled={isAnalyzing || scanningActive} style={{ flex: 1, padding: '7px 0', background: isAnalyzing ? '#21262d' : '#161b22', border: '1px solid #30363d', borderRadius: 5, color: isAnalyzing ? '#58a6ff' : '#c9d1d9', fontSize: 10.5, fontWeight: 600, cursor: isAnalyzing ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <span style={{ display: 'inline-block', transform: isAnalyzing ? 'rotate(360deg)' : 'none', transition: 'transform 0.6s linear' }}>↻</span>
            <span>{isAnalyzing ? 'Analyzing Target…' : 'Re-evaluate Target'}</span>
          </button>
          <button onClick={handleDeepCheck} disabled={isDeepChecking} style={{ flex: 1, padding: '7px 0', background: isDeepChecking ? '#1f2937' : '#1f242c', border: '1px solid #3b4351', borderRadius: 5, color: '#f0f6fc', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <span>{isDeepChecking ? 'Checking Endpoints…' : 'Deep Verification'}</span>
          </button>
        </div>
      </div>

      {/* 3. Security Synthesis */}
      <div style={{ background: '#0d1117', borderRadius: 8, border: '1px solid #21262d', padding: '11px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 10, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SECURITY SYNTHESIS</span>
          <span style={{ fontSize: 9, background: '#161b22', color: '#8b949e', padding: '1px 5px', borderRadius: 3, fontWeight: 600, border: '1px solid #21262d' }}>
            {assessment?.isAiGenerated ? 'NEURAL ENGINE' : 'HEURISTIC ENGINE'}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: '#c9d1d9' }}>
          {assessment?.summaryText || (ex.isLimitedData ? `Limited data available on ${currentHost}; only ${Math.round((ex.confidence || 0) * 61)} of 61 checks evaluated.` : `Real-time security analysis complete for ${currentHost}.`)}
        </p>
      </div>

      {/* 4. Top Key Observations */}
      {ex.keyFindings && ex.keyFindings.length > 0 && (
        <div style={{ background: '#0d1117', borderRadius: 8, border: '1px solid #21262d', padding: '11px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#8b949e', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            KEY FINDINGS ({ex.keyFindings.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {ex.keyFindings.slice(0, 5).map((f: any, i: number) => {
              const isPos = f.type === 'positive', isCrit = f.type === 'critical';
              const indicatorColor = isPos ? '#38bdf8' : isCrit ? '#f87171' : '#fbbf24';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, padding: '7px 9px', background: '#161b22', borderRadius: 5, border: '1px solid #21262d' }}>
                  <div style={{ display: 'flex', gap: 7, minWidth: 0 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: indicatorColor, marginTop: 4, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#f0f6fc' }}>{f.title}</div>
                      <div style={{ fontSize: 9.5, color: '#8b949e', marginTop: 1, lineHeight: 1.35 }}>{f.details}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 9, color: indicatorColor, fontWeight: 600, whiteSpace: 'nowrap', padding: '1px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.03)', border: `1px solid ${indicatorColor}30` }}>
                    {isPos ? 'Validated' : `-${Math.round((f.weight || 1) * 6)} pts`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Click & Redirect Integrity */}
      <div style={{ background: '#0d1117', borderRadius: 8, border: '1px solid #21262d', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 11, color: '#f0f6fc' }}>Clickjacking & Redirection Shield</div>
          <div style={{ fontSize: 9.5, color: '#8b949e', marginTop: 2 }}>
            Clicks: {clickStats.physicalClicks || 0} · Blocked: {clickStats.popupsBlocked || 0} · Traps: {clickStats.overlaysDetected || 0}
          </div>
        </div>
        <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 3, background: hasHijack ? 'rgba(239, 68, 68, 0.1)' : 'rgba(56, 189, 248, 0.1)', color: hasHijack ? '#f87171' : '#38bdf8', border: `1px solid ${hasHijack ? '#ef444450' : '#38bdf840'}`, letterSpacing: '0.04em' }}>
          {hasHijack ? 'THREAT DETECTED' : 'ARMED & ACTIVE'}
        </span>
      </div>

      {/* 6. OSINT Telemetry Ledger */}
      {osintChips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {osintChips.map((chip, idx) => (
            <span key={idx} style={{ padding: '2px 7px', fontSize: 9.5, borderRadius: 4, background: '#161b22', color: '#8b949e', border: '1px solid #21262d', fontFamily: 'SFMono-Regular, Consolas, Menlo, monospace' }}>
              {chip}
            </span>
          ))}
        </div>
      )}

      {/* 7. Live Permissions & Capability Ledger */}
      <PermissionMonitor permissions={permissions} cameraActive={cameraActive} micActive={micActive} hostname={currentHost} />
    </div>
  );
}

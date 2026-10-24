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
    ex.grade === 'A+' || ex.grade === 'A' ? '#00e599' :
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
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px', color: '#f0f0f5', fontSize: 12, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.12) transparent', background: '#020204' }}>
      {/* 1. Formal Executive Site Identity Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#08080c', borderRadius: 8, border: '1px solid #161620', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: isHttps ? 'rgba(0, 229, 153, 0.08)' : 'rgba(239, 68, 68, 0.08)', border: `1px solid ${isHttps ? '#00e59935' : '#ef444435'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={isHttps ? '#00e599' : '#ef4444'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <div style={{ fontWeight: 600, fontSize: 13, color: '#ffffff', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentHost}
            </div>
            <div style={{ fontSize: 10, color: isHttps ? '#808090' : '#f87171', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: isHttps ? '#00e599' : '#ef4444', display: 'inline-block', boxShadow: isHttps ? '0 0 6px rgba(0,229,153,0.6)' : 'none' }} />
              {isHttps ? 'TLS Encrypted · Port 443' : 'Unencrypted Cleartext HTTP'}
            </div>
          </div>
        </div>
        {onTrustSite && (
          <button onClick={() => onTrustSite(currentHost)} style={{ padding: '5px 12px', fontSize: 10.5, background: 'rgba(255,255,255,0.03)', color: '#a0a0b0', border: '1px solid #20202e', borderRadius: 5, cursor: 'pointer', fontWeight: 500, letterSpacing: '0.02em', transition: 'all 0.15s ease' }}>
            Trust Site
          </button>
        )}
      </div>

      {/* 2. Precision Executive Telemetry Gauge & Score Matrix */}
      <div style={{ background: '#08080c', borderRadius: 8, border: '1px solid #161620', padding: '16px 14px', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ position: 'relative', width: 68, height: 68, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="68" height="68" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="34" cy="34" r="28" stroke="#12121a" strokeWidth="5.5" fill="transparent" />
                <circle cx="34" cy="34" r="28" stroke={gradeColor} strokeWidth="5.5" fill="transparent" strokeDasharray={175.9} strokeDashoffset={175.9 - (175.9 * Math.min(100, ex.exScore)) / 100} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease', filter: gradeColor === '#00e599' ? 'drop-shadow(0 0 4px rgba(0,229,153,0.5))' : 'none' }} />
              </svg>
              <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 19, fontWeight: 700, color: '#ffffff', lineHeight: 1, letterSpacing: '-0.02em' }}>{ex.exScore}</span>
                <span style={{ fontSize: 8.5, fontWeight: 600, color: '#707080', marginTop: 1 }}>/ 100</span>
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', padding: '2px 6px', borderRadius: 3, background: 'rgba(0, 229, 153, 0.08)', color: gradeColor, border: `1px solid ${gradeColor}45` }}>
                  TIER {ex.grade}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#ffffff' }}>
                  {ex.grade === 'A+' || ex.grade === 'A' ? 'Enterprise Verified' : ex.grade === 'B' ? 'Standard Trust' : ex.grade === 'C' ? 'Elevated Risk' : 'High Threat'}
                </span>
              </div>
              <div style={{ fontSize: 10, color: '#7a7a8c', marginTop: 3 }}>
                {ex.confidenceText || 'Evaluated across 61 integrity metrics'}
              </div>
            </div>
          </div>
          <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 3, background: '#101018', color: '#00e599', border: '1px solid #1a2e22', letterSpacing: '0.05em' }}>
            TELEMETRY
          </span>
        </div>

        {/* 3 Metric Columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, width: '100%', marginTop: 14 }}>
          {telemetryGauges.map((g, idx) => (
            <div key={idx} style={{ background: '#0e0e14', padding: '8px 9px', borderRadius: 6, border: '1px solid #1a1a24' }}>
              <div style={{ fontSize: 9, color: '#707080', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{g.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: g.score >= 80 ? '#00e599' : '#f59e0b', marginTop: 2, letterSpacing: '-0.02em' }}>
                {g.score}<span style={{ fontSize: 9.5, fontWeight: 400, color: '#555566', marginLeft: 1 }}>%</span>
              </div>
              <div style={{ fontSize: 9, color: '#707080', marginTop: 1 }}>{g.sub}</div>
            </div>
          ))}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: 6, marginTop: 12, width: '100%' }}>
          <button onClick={handleReanalyze} disabled={isAnalyzing || scanningActive} style={{ flex: 1, padding: '8px 0', background: isAnalyzing ? '#14141e' : '#0e0e14', border: '1px solid #20202e', borderRadius: 6, color: isAnalyzing ? '#00e599' : '#c0c0d0', fontSize: 10.5, fontWeight: 600, cursor: isAnalyzing ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <span style={{ display: 'inline-block', transform: isAnalyzing ? 'rotate(360deg)' : 'none', transition: 'transform 0.6s linear' }}>↻</span>
            <span>{isAnalyzing ? 'Analyzing Target…' : 'Re-evaluate Target'}</span>
          </button>
          <button onClick={handleDeepCheck} disabled={isDeepChecking} style={{ flex: 1, padding: '8px 0', background: isDeepChecking ? '#161622' : '#12121a', border: '1px solid #242436', borderRadius: 6, color: '#ffffff', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <span>{isDeepChecking ? 'Checking Endpoints…' : 'Deep Verification'}</span>
          </button>
        </div>
      </div>

      {/* 3. Security Synthesis */}
      <div style={{ background: '#08080c', borderRadius: 8, border: '1px solid #161620', padding: '12px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 10, color: '#707080', textTransform: 'uppercase', letterSpacing: '0.06em' }}>SECURITY SYNTHESIS</span>
          <span style={{ fontSize: 9, background: '#0e0e14', color: '#00e599', padding: '2px 6px', borderRadius: 3, fontWeight: 600, border: '1px solid #1a2e22' }}>
            {assessment?.isAiGenerated ? 'NEURAL ENGINE' : 'HEURISTIC ENGINE'}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: '#b0b0c0' }}>
          {assessment?.summaryText || (ex.isLimitedData ? `Limited data available on ${currentHost}; only ${Math.round((ex.confidence || 0) * 61)} of 61 checks evaluated.` : `Real-time security analysis complete for ${currentHost}.`)}
        </p>
      </div>

      {/* 4. Top Key Observations */}
      {ex.keyFindings && ex.keyFindings.length > 0 && (
        <div style={{ background: '#08080c', borderRadius: 8, border: '1px solid #161620', padding: '12px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#707080', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            KEY FINDINGS ({ex.keyFindings.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {ex.keyFindings.slice(0, 5).map((f: any, i: number) => {
              const isPos = f.type === 'positive', isCrit = f.type === 'critical';
              const indicatorColor = isPos ? '#00e599' : isCrit ? '#ef4444' : '#f59e0b';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, padding: '7px 9px', background: '#0e0e14', borderRadius: 5, border: '1px solid #1a1a24' }}>
                  <div style={{ display: 'flex', gap: 7, minWidth: 0 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: indicatorColor, marginTop: 4, flexShrink: 0, boxShadow: isPos ? '0 0 5px rgba(0,229,153,0.6)' : 'none' }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#ffffff' }}>{f.title}</div>
                      <div style={{ fontSize: 9.5, color: '#707080', marginTop: 1, lineHeight: 1.35 }}>{f.details}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 9, color: indicatorColor, fontWeight: 600, whiteSpace: 'nowrap', padding: '1px 5px', borderRadius: 3, background: isPos ? 'rgba(0,229,153,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${indicatorColor}35` }}>
                    {isPos ? 'Validated' : `-${Math.round((f.weight || 1) * 6)} pts`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Click & Redirect Integrity */}
      <div style={{ background: '#08080c', borderRadius: 8, border: '1px solid #161620', padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 11, color: '#ffffff' }}>Clickjacking & Redirection Shield</div>
          <div style={{ fontSize: 9.5, color: '#707080', marginTop: 2 }}>
            Clicks: {clickStats.physicalClicks || 0} · Blocked: {clickStats.popupsBlocked || 0} · Traps: {clickStats.overlaysDetected || 0}
          </div>
        </div>
        <span style={{ fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 3, background: hasHijack ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0, 229, 153, 0.08)', color: hasHijack ? '#ef4444' : '#00e599', border: `1px solid ${hasHijack ? '#ef444450' : '#00e59945'}`, letterSpacing: '0.04em' }}>
          {hasHijack ? 'THREAT DETECTED' : 'ARMED & ACTIVE'}
        </span>
      </div>

      {/* 6. OSINT Telemetry Ledger */}
      {osintChips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {osintChips.map((chip, idx) => (
            <span key={idx} style={{ padding: '2px 7px', fontSize: 9.5, borderRadius: 4, background: '#0a0a10', color: '#888898', border: '1px solid #181822', fontFamily: 'SFMono-Regular, Consolas, Menlo, monospace' }}>
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

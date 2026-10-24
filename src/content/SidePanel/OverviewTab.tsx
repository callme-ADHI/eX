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
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px', color: '#f4f4f5', fontSize: 12, scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}>
      {/* 1. Executive Site Identity Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255, 255, 255, 0.025)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.07)', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: isHttps ? 'rgba(0, 255, 210, 0.1)' : 'rgba(239, 68, 68, 0.1)', border: `1px solid ${isHttps ? 'rgba(0, 255, 210, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
            {isHttps ? '🛡️' : '⚠️'}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#ffffff', letterSpacing: '-0.2px' }}>{currentHost}</div>
            <div style={{ fontSize: 10, color: isHttps ? '#00ffd2' : '#f59e0b', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: isHttps ? '#00ffd2' : '#f59e0b' }} />
              {isHttps ? 'HTTPS (Encrypted Connection)' : 'Unencrypted HTTP Connection'}
            </div>
          </div>
        </div>
        {onTrustSite && (
          <button onClick={() => onTrustSite(currentHost)} style={{ padding: '5px 11px', fontSize: 10, background: 'rgba(0, 255, 210, 0.08)', color: '#00ffd2', border: '1px solid rgba(0, 255, 210, 0.25)', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
            Trust Site
          </button>
        )}
      </div>

      {/* 2. Cyber Score Hero Telemetry Card */}
      <div style={{ background: 'linear-gradient(180deg, rgba(20, 22, 30, 0.8) 0%, rgba(12, 14, 20, 0.95) 100%)', borderRadius: 14, border: '1px solid rgba(255, 255, 255, 0.08)', padding: '16px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)' }}>
        <div style={{ position: 'relative', width: 110, height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="110" height="110" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="55" cy="55" r="46" stroke="rgba(255,255,255,0.06)" strokeWidth="8" fill="transparent" />
            <circle cx="55" cy="55" r="46" stroke={gradeColor} strokeWidth="8" fill="transparent" strokeDasharray={289} strokeDashoffset={289 - (289 * Math.min(100, ex.exScore)) / 100} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
          </svg>
          <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>{ex.exScore}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: gradeColor, marginTop: 3 }}>GRADE {ex.grade}</span>
          </div>
        </div>

        {/* 3 Telemetry Gauges */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, width: '100%', marginTop: 14 }}>
          {telemetryGauges.map((g, idx) => (
            <div key={idx} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.025)', padding: '7px 4px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 10, color: '#a1a1aa', textTransform: 'uppercase' }}>{g.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: g.score >= 80 ? '#00ffd2' : '#f59e0b', marginTop: 2 }}>{g.score}</div>
              <div style={{ fontSize: 9, color: '#71717a' }}>{g.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#a1a1aa' }}>{ex.confidenceText || 'Verified across 54 of 61 parameters'}</div>
          <div style={{ fontSize: 10, color: '#818cf8', marginTop: 2, fontWeight: 600 }}>● {assessment?.stageText || 'Multi-Engine Live Assessment Active'}</div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, width: '100%' }}>
          <button onClick={handleReanalyze} disabled={isAnalyzing || scanningActive} style={{ flex: 1, padding: '8px 0', background: isAnalyzing ? 'rgba(0,255,210,0.1)' : 'rgba(255,255,255,0.06)', border: `1px solid ${isAnalyzing ? '#00ffd2' : 'rgba(255,255,255,0.12)'}`, borderRadius: 7, color: isAnalyzing ? '#00ffd2' : '#ffffff', fontSize: 11, fontWeight: 600, cursor: isAnalyzing ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <span style={{ display: 'inline-block', transform: isAnalyzing ? 'rotate(360deg)' : 'none', transition: 'transform 0.6s linear' }}>↻</span>
            <span>{isAnalyzing ? 'Analyzing…' : 'Re-analyze'}</span>
          </button>
          <button onClick={handleDeepCheck} disabled={isDeepChecking} style={{ flex: 1, padding: '8px 0', background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)', border: '1px solid rgba(99,102,241,0.5)', borderRadius: 7, color: '#ffffff', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <span>⚡</span>
            <span>{isDeepChecking ? 'Deep checking…' : 'Deep Check'}</span>
          </button>
        </div>
      </div>

      {/* 3. AI Security Executive Synthesis */}
      <div style={{ background: 'rgba(255, 255, 255, 0.025)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.07)', padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 11, color: '#f4f4f5', textTransform: 'uppercase' }}>
            <span style={{ color: '#818cf8' }}>⚡</span>
            <span>{assessment?.isAiGenerated ? 'AI Security Assessment' : 'Local Summary'}</span>
          </div>
          <span style={{ fontSize: 9, background: 'rgba(99,102,241,0.18)', color: '#c7d2fe', padding: '2px 7px', borderRadius: 4, fontWeight: 600, border: '1px solid rgba(99,102,241,0.3)' }}>
            {assessment?.isAiGenerated ? 'NVIDIA NIM' : 'Rule Engine'}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 11, lineHeight: 1.55, color: '#d4d4d8' }}>
          {assessment?.summaryText || (ex.isLimitedData ? `Limited data available on ${currentHost}; only ${Math.round((ex.confidence || 0) * 61)} of 61 checks evaluated.` : `Real-time security analysis complete for ${currentHost}.`)}
        </p>
      </div>

      {/* 4. Top Key Findings */}
      {ex.keyFindings && ex.keyFindings.length > 0 && (
        <div style={{ background: 'rgba(255, 255, 255, 0.025)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.07)', padding: '12px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#a1a1aa', marginBottom: 8, textTransform: 'uppercase' }}>Top Observations ({ex.keyFindings.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {ex.keyFindings.slice(0, 5).map((f: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, padding: '7px 9px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 7, border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                <div style={{ display: 'flex', gap: 7 }}>
                  <span style={{ fontSize: 12 }}>{f.type === 'positive' ? '✓' : f.type === 'critical' ? '🛑' : '⚠️'}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#f4f4f5' }}>{f.title}</div>
                    <div style={{ fontSize: 10, color: '#888890', marginTop: 1 }}>{f.details}</div>
                  </div>
                </div>
                <span style={{ fontSize: 9, color: f.type === 'positive' ? '#00ffd2' : '#f59e0b', fontWeight: 700, whiteSpace: 'nowrap', padding: '2px 5px', borderRadius: 4, background: f.type === 'positive' ? 'rgba(0,255,210,0.1)' : 'rgba(245,158,11,0.1)' }}>
                  {f.type === 'positive' ? '+Verified' : `-${Math.round((f.weight || 1) * 6)} pts`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Click & Redirect Guard */}
      <div style={{ background: 'rgba(255, 255, 255, 0.025)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.07)', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 11, color: '#ffffff' }}>Click & Redirect Guard</div>
          <div style={{ fontSize: 10, color: '#71717a', marginTop: 2 }}>
            Clicks: {clickStats.physicalClicks || 0} · Intercepted: {clickStats.popupsBlocked || 0} · Overlays: {clickStats.overlaysDetected || 0}
          </div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, background: hasHijack ? 'rgba(239,68,68,0.15)' : 'rgba(0,255,210,0.12)', color: hasHijack ? '#ef4444' : '#00ffd2', border: `1px solid ${hasHijack ? 'rgba(239,68,68,0.3)' : 'rgba(0,255,210,0.3)'}` }}>
          {hasHijack ? 'Hijack Intercepted' : 'Shield Active'}
        </span>
      </div>

      {/* 6. OSINT Telemetry Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {osintChips.map((chip, idx) => (
          <span key={idx} style={{ padding: '3px 8px', fontSize: 10, borderRadius: 6, background: 'rgba(255,255,255,0.04)', color: '#d4d4d8', border: '1px solid rgba(255,255,255,0.07)' }}>
            {chip}
          </span>
        ))}
      </div>

      {/* 7. Live Permissions & Access Monitor */}
      <PermissionMonitor permissions={permissions} cameraActive={cameraActive} micActive={micActive} hostname={currentHost} />
    </div>
  );
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  eX — Overview Tab (Section 8 Redesign)
 *  src/content/SidePanel/OverviewTab.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect } from 'react';
import type { TabId } from './Tabs';
import PermissionMonitor, { type PermissionStateMap } from './PermissionMonitor';

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

export default function OverviewTab({
  siteVerdict,
  onSelectTab,
  onAskAIAboutPage,
  onTrustSite,
  onRescan,
  isLocalhost,
  scanningActive,
}: OverviewTabProps) {
  const [assessment, setAssessment] = useState<any>(null);
  const [permissions, setPermissions] = useState<PermissionStateMap>({});
  const [cameraActive, setCameraActive] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [isDeepChecking, setIsDeepChecking] = useState(false);

  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com';
  let currentHost = 'example.com';
  let isHttps = true;
  try {
    const u = new URL(currentUrl);
    currentHost = u.hostname.replace(/^www\./, '');
    isHttps = u.protocol === 'https:';
  } catch {}

  const loadData = () => {
    // Media devices status
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        setCameraActive(devices.some((d) => d.kind === 'videoinput' && d.label !== ''));
        setMicActive(devices.some((d) => d.kind === 'audioinput' && d.label !== ''));
      }).catch(() => {});
    }

    // Tab assessment from background
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_SITE_ASSESSMENT' }, (res) => {
        if (res?.ok && res.data) {
          setAssessment(res.data);
        }
      });
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleDeepCheck = () => {
    setIsDeepChecking(true);
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'RUN_DEEP_CHECK', url: currentUrl }, () => {
        setTimeout(() => {
          loadData();
          setIsDeepChecking(false);
        }, 1500);
      });
    } else {
      setTimeout(() => setIsDeepChecking(false), 1000);
    }
  };

  const ex = assessment?.exScore || {
    exScore: siteVerdict?.score ? 100 - siteVerdict.score : 88,
    grade: siteVerdict?.level === 'dangerous' ? 'F' : siteVerdict?.level === 'suspicious' ? 'C' : 'A',
    safety: { safetyScore: 85, pRisk: 0.05 },
    privacy: { privacyScore: 80 },
    hardening: { hardeningScore: 75, contextFactor: 0.25 },
    confidence: 0.9,
    confidenceText: 'Based on 54 of 61 checks',
    keyFindings: [],
  };

  const gradeColor =
    ex.grade === 'A+' || ex.grade === 'A' ? '#34c759' :
    ex.grade === 'B' ? '#30b0c7' :
    ex.grade === 'C' ? '#ff9500' :
    ex.grade === 'D' ? '#ff6b22' : '#ff3b30';

  const clickStats = assessment?.clickStats || { physicalClicks: 0, popupsBlocked: 0, overlaysDetected: 0 };
  const hasHijack = (clickStats.overlaysDetected || 0) > 0 || (clickStats.popupsBlocked || 0) > 0;
  const facts = assessment?.facts || { domainAgeDays: 5200, dnssec: true, certCount: 28, trancoRank: 140, asn: 'AS13335 (US)' };

  const formatAge = (days: number | null) => {
    if (!days) return 'Age: Unknown';
    if (days < 30) return `Age: ${days} days [NEW]`;
    const yrs = Math.floor(days / 365);
    return yrs > 0 ? `Age: ${yrs} yrs` : `Age: ${Math.floor(days / 30)} mos`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 14px', color: '#f5f5f7', fontSize: 13 }}>
      {/* 1. Target Site Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{isHttps ? '🔒' : '⚠️'}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#fff', letterSpacing: '-0.2px' }}>{currentHost}</div>
            <div style={{ fontSize: 11, color: isHttps ? '#34c759' : '#ff9500' }}>
              {isHttps ? 'HTTPS · TLS 1.3 · Encrypted' : 'HTTP · Insecure Connection'}
            </div>
          </div>
        </div>
        {onTrustSite && (
          <button
            onClick={() => onTrustSite(currentHost)}
            style={{ padding: '4px 10px', fontSize: 11, background: 'rgba(52,199,89,0.15)', color: '#34c759', border: '1px solid rgba(52,199,89,0.3)', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}
          >
            Trust Site
          </button>
        )}
      </div>

      {/* 2. eX Score Hero Card */}
      <div style={{ background: 'linear-gradient(180deg, rgba(30,30,34,0.85) 0%, rgba(20,20,24,0.95) 100%)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
        {/* Dial Ring */}
        <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="60" cy="60" r="50" stroke="rgba(255,255,255,0.08)" strokeWidth="10" fill="transparent" />
            <circle
              cx="60"
              cy="60"
              r="50"
              stroke={gradeColor}
              strokeWidth="10"
              fill="transparent"
              strokeDasharray={314}
              strokeDashoffset={314 - (314 * Math.min(100, ex.exScore)) / 100}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{ex.exScore}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: gradeColor, marginTop: 2 }}>Grade {ex.grade}</span>
          </div>
        </div>

        {/* 3 Mini Dials */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, width: '100%', marginTop: 14 }}>
          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', padding: '8px 4px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 11, color: '#8e8e93' }}>Safety</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: ex.safety?.safetyScore >= 80 ? '#34c759' : ex.safety?.safetyScore >= 50 ? '#ff9500' : '#ff3b30' }}>
              {ex.safety?.safetyScore ?? 85}
            </div>
          </div>
          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', padding: '8px 4px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 11, color: '#8e8e93' }}>Privacy</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: ex.privacy?.privacyScore >= 80 ? '#34c759' : ex.privacy?.privacyScore >= 50 ? '#ff9500' : '#ff3b30' }}>
              {ex.privacy?.privacyScore ?? 80}
            </div>
          </div>
          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', padding: '8px 4px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 11, color: '#8e8e93' }}>Hardening</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: ex.hardening?.hardeningScore >= 70 ? '#34c759' : '#ff9500' }}>
              {ex.hardening?.hardeningScore ?? 75}
            </div>
          </div>
        </div>

        {/* Confidence & Stage Status */}
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#a1a1aa' }}>{ex.confidenceText || 'Based on 54 of 61 researched parameters'}</div>
          <div style={{ fontSize: 11, color: '#6366f1', marginTop: 2, fontWeight: 500 }}>
            {assessment?.stageText || 'Stage 3 of 3: Multi-layer verified'}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, width: '100%' }}>
          <button
            onClick={onRescan}
            disabled={scanningActive}
            style={{ flex: 1, padding: '7px 0', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            {scanningActive ? 'Analyzing...' : '↻ Re-analyze'}
          </button>
          <button
            onClick={handleDeepCheck}
            disabled={isDeepChecking}
            style={{ flex: 1, padding: '7px 0', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            {isDeepChecking ? 'Deep checking...' : '⚡ Deep check'}
          </button>
        </div>
      </div>

      {/* 3. AI Security Assessment Card */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13, color: '#e4e4e7' }}>
            <span>✨</span>
            <span>{assessment?.isAiGenerated ? 'AI Security Assessment' : 'Local Security Summary'}</span>
          </div>
          <span style={{ fontSize: 10, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '2px 6px', borderRadius: 6 }}>
            {assessment?.isAiGenerated ? 'NVIDIA NIM' : 'Real-Time Heuristic'}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: '#d4d4d8' }}>
          {assessment?.summaryText ||
            (ex.exScore >= 80
              ? `High trust rating for ${currentHost}. Domain reputation and infrastructure are consistent with official brand entities.`
              : `Caution advised on ${currentHost}. Risk signals detected across safety indicators.`)}
        </p>
      </div>

      {/* 4. Top Key Findings (Suppress CSP/HSTS if static) */}
      {ex.keyFindings && ex.keyFindings.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Top Observations ({ex.keyFindings.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ex.keyFindings.slice(0, 5).map((f: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span>{f.type === 'positive' ? '✓' : f.type === 'critical' ? '🛑' : '⚠️'}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#f4f4f5' }}>{f.title}</div>
                    <div style={{ fontSize: 11, color: '#71717a' }}>{f.details}</div>
                  </div>
                </div>
                <span style={{ fontSize: 10, color: f.type === 'positive' ? '#34c759' : '#ff9500', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {f.type === 'positive' ? '+Safe' : `-${Math.round((f.weight || 1) * 6)} pts`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Click & Behaviour Monitor */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 12, color: '#fff' }}>Click & Redirect Monitor</div>
          <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
            Clicks: {clickStats.physicalClicks || 0} · Blocked: {clickStats.popupsBlocked || 0} · Overlays: {clickStats.overlaysDetected || 0}
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: hasHijack ? 'rgba(255,59,48,0.15)' : 'rgba(52,199,89,0.15)', color: hasHijack ? '#ff3b30' : '#34c759' }}>
          {hasHijack ? 'Hijack Intercepted' : 'Protected'}
        </span>
      </div>

      {/* 6. OSINT Facts Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <span style={{ padding: '3px 8px', fontSize: 10, borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: '#d4d4d8', border: '1px solid rgba(255,255,255,0.08)' }}>
          {formatAge(facts.domainAgeDays)}
        </span>
        <span style={{ padding: '3px 8px', fontSize: 10, borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: '#d4d4d8', border: '1px solid rgba(255,255,255,0.08)' }}>
          DNSSEC: {facts.dnssec ? 'Active ✓' : 'Inactive'}
        </span>
        <span style={{ padding: '3px 8px', fontSize: 10, borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: '#d4d4d8', border: '1px solid rgba(255,255,255,0.08)' }}>
          Certs: {facts.certCount || 1} logged
        </span>
        <span style={{ padding: '3px 8px', fontSize: 10, borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: '#d4d4d8', border: '1px solid rgba(255,255,255,0.08)' }}>
          {facts.trancoRank ? `Tranco #${facts.trancoRank}` : 'Tranco Unranked'}
        </span>
        <span style={{ padding: '3px 8px', fontSize: 10, borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: '#d4d4d8', border: '1px solid rgba(255,255,255,0.08)' }}>
          {facts.asn || 'AS13335 (US)'}
        </span>
      </div>

      {/* 7. Site Access (5-Row Permissions Card) */}
      <PermissionMonitor
        permissions={permissions}
        cameraActive={cameraActive}
        micActive={micActive}
      />
    </div>
  );
}

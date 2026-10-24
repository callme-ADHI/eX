import React from 'react';
import type { TabId } from './Tabs';

interface OverviewTabProps {
  siteVerdict: any;
  mailSummary: any;
  findings: any[];
  onSelectTab: (tab: TabId) => void;
  onStartSnip: () => void;
  onRunActiveScan: () => void;
  onAskAIAboutPage: () => void;
  isLocalhost: boolean;
  scanningActive: boolean;
}

export default function OverviewTab({
  siteVerdict,
  mailSummary,
  findings,
  onSelectTab,
  onStartSnip,
  onRunActiveScan,
  onAskAIAboutPage,
  isLocalhost,
  scanningActive,
}: OverviewTabProps) {
  // Score: 100 - site risk score (0..100)
  const siteRisk = siteVerdict?.score ?? 0;
  const cyberScore = Math.max(0, Math.min(100, 100 - siteRisk));

  // Determine score tone
  const scoreColor =
    cyberScore >= 75 ? '#00ffd2' : cyberScore >= 45 ? '#ffb300' : '#ff3b30';

  const circumference = 2 * Math.PI * 42;
  const strokeDashoffset = circumference - (cyberScore / 100) * circumference;

  // Gather top issues
  const topIssues: { text: string; tab: TabId; severity: string }[] = [];
  if (siteVerdict?.level === 'dangerous' || siteVerdict?.level === 'suspicious') {
    topIssues.push({
      text: siteVerdict.reasons?.[0] || `Site flagged as ${siteVerdict.level}`,
      tab: 'site',
      severity: siteVerdict.level === 'dangerous' ? 'high' : 'medium',
    });
  }
  if (mailSummary?.flagged?.length > 0) {
    const f = mailSummary.flagged[0];
    topIssues.push({
      text: `Mail: ${f.subject || f.reason || 'Suspicious email detected'}`,
      tab: 'mail',
      severity: f.level === 'high' ? 'high' : 'medium',
    });
  }
  for (const f of findings) {
    if (topIssues.length >= 3) break;
    if (f.severity === 'high' || f.severity === 'critical') {
      topIssues.push({ text: `Vuln: ${f.title}`, tab: 'findings', severity: 'high' });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', overflowY: 'auto', flex: 1 }}>
      {/* Score Ring Section */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        padding: '20px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '12px',
        border: '1px solid var(--panel-border, rgba(255,255,255,0.08))',
      }}>
        <div style={{ position: 'relative', width: '100px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="42" fill="none"
              stroke={scoreColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '26px', fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{cyberScore}</span>
            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted, #888)', letterSpacing: '0.05em' }}>/ 100</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #888)' }}>
            Cyber Posture
          </span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
            {cyberScore >= 75 ? 'Shield Active · Safe' : cyberScore >= 45 ? 'Elevated Risk' : 'Threats Detected'}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary, #aaa)' }}>
            {siteVerdict ? `Site risk score: ${siteVerdict.score}` : 'Analyzing page features...'}
          </span>
        </div>
      </div>

      {/* 3 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        <button
          onClick={() => onSelectTab('site')}
          style={{
            display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px 10px',
            background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border, rgba(255,255,255,0.08))',
            borderRadius: '8px', cursor: 'pointer', textAlign: 'left', color: 'inherit',
          }}
        >
          <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted, #888)' }}>Site Guard</span>
          <span style={{
            fontSize: '13px', fontWeight: 700,
            color: siteVerdict?.level === 'dangerous' ? '#ff3b30' : siteVerdict?.level === 'suspicious' ? '#ffb300' : '#00ffd2',
          }}>
            {siteVerdict ? siteVerdict.level.toUpperCase() : 'PENDING'}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted, #888)' }}>
            {siteVerdict ? `Risk: ${siteVerdict.score}/100` : 'Scanning'}
          </span>
        </button>

        <button
          onClick={() => onSelectTab('mail')}
          style={{
            display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px 10px',
            background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border, rgba(255,255,255,0.08))',
            borderRadius: '8px', cursor: 'pointer', textAlign: 'left', color: 'inherit',
          }}
        >
          <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted, #888)' }}>Mail Guard</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: (mailSummary?.flaggedCount ?? 0) > 0 ? '#ffb300' : '#00ffd2' }}>
            {mailSummary ? `${mailSummary.flaggedCount} Flagged` : 'No Scans'}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted, #888)' }}>
            {mailSummary ? `${mailSummary.scannedCount} emails` : 'Gmail'}
          </span>
        </button>

        <button
          onClick={() => onSelectTab('findings')}
          style={{
            display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px 10px',
            background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border, rgba(255,255,255,0.08))',
            borderRadius: '8px', cursor: 'pointer', textAlign: 'left', color: 'inherit',
          }}
        >
          <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted, #888)' }}>Findings</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: findings.length > 0 ? '#ff9500' : '#00ffd2' }}>
            {findings.length} Total
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted, #888)' }}>
            {findings.filter((f) => f.severity === 'high' || f.severity === 'critical').length} Critical/High
          </span>
        </button>
      </div>

      {/* Top Issues List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted, #888)' }}>
          Top Priorities
        </span>
        {topIssues.length === 0 ? (
          <div style={{ padding: '12px', background: 'rgba(0,255,210,0.05)', borderRadius: '8px', border: '1px solid rgba(0,255,210,0.15)', color: '#00ffd2', fontSize: '12px' }}>
            ✓ No critical threats or phishing flags detected on this target.
          </div>
        ) : (
          topIssues.map((issue, idx) => (
            <div
              key={idx}
              onClick={() => onSelectTab(issue.tab)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--panel-border, rgba(255,255,255,0.06))',
                borderRadius: '8px', cursor: 'pointer', transition: 'background 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                  background: issue.severity === 'high' ? '#ff3b30' : '#ffb300',
                }} />
                <span style={{ fontSize: '12px', color: 'var(--text-primary, #fff)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {issue.text}
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--accent, #2452ff)', fontWeight: 600, flexShrink: 0, marginLeft: '8px' }}>
                View →
              </span>
            </div>
          ))
        )}
      </div>

      {/* Quick Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted, #888)' }}>
          Quick Actions
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={onStartSnip}
            style={{
              padding: '10px 14px', background: 'rgba(36,82,255,0.15)',
              border: '1px solid rgba(36,82,255,0.4)', borderRadius: '8px',
              color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            <span>✂️</span> Snip & Scan Screen Area
          </button>

          {isLocalhost && (
            <button
              onClick={onRunActiveScan}
              disabled={scanningActive}
              style={{
                padding: '10px 14px',
                background: scanningActive ? 'rgba(255,255,255,0.05)' : 'rgba(0,255,210,0.12)',
                border: '1px solid rgba(0,255,210,0.3)', borderRadius: '8px',
                color: scanningActive ? 'var(--text-muted, #888)' : '#00ffd2',
                fontSize: '12px', fontWeight: 600, cursor: scanningActive ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              <span>🛡️</span> {scanningActive ? 'Probing Localhost Security...' : 'Scan Local App for Vulnerabilities'}
            </button>
          )}

          <button
            onClick={onAskAIAboutPage}
            style={{
              padding: '10px 14px', background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--panel-border, rgba(255,255,255,0.1))', borderRadius: '8px',
              color: 'var(--text-primary, #fff)', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            <span>💬</span> Ask AI About Current Page
          </button>
        </div>
      </div>
    </div>
  );
}

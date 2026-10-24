import React, { useState } from 'react';

interface SiteTabProps {
  url: string;
  verdict: any;
  onTrustSite: (hostname: string) => void;
  onRescan: () => void;
  scanning: boolean;
}

export default function SiteTab({ url, verdict, onTrustSite, onRescan, scanning }: SiteTabProps) {
  const [trusted, setTrusted] = useState(false);

  let hostname = '';
  let isHttps = false;
  try {
    const p = new URL(url);
    hostname = p.hostname;
    isHttps = p.protocol === 'https:';
  } catch (_) {}

  const level = verdict?.level ?? 'safe';
  const score = verdict?.score ?? 0;
  const confidence = verdict ? Math.round((verdict.confidence ?? 0.8) * 100) : 0;
  const reasons: string[] = verdict?.reasons ?? [];

  const levelColor =
    level === 'dangerous' ? '#ff3b30' : level === 'suspicious' ? '#ff9500' : '#00ffd2';

  const handleTrust = () => {
    if (!hostname) return;
    onTrustSite(hostname);
    setTrusted(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', overflowY: 'auto', flex: 1 }}>
      {/* Banner */}
      <div style={{
        padding: '16px',
        borderRadius: '10px',
        background: level === 'dangerous' ? 'rgba(255,59,48,0.1)' : level === 'suspicious' ? 'rgba(255,149,0,0.1)' : 'rgba(0,255,210,0.08)',
        border: `1px solid ${levelColor}40`,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: levelColor }}>
            Site Verdict: {level.toUpperCase()}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: levelColor }}>
            Risk Score: {score}/100
          </span>
        </div>
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
          {hostname || 'Active Site'}
        </span>
        <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-muted, #aaa)' }}>
          <span>Source: {verdict?.source || 'passive/AI'}</span>
          <span>•</span>
          <span>Confidence: {confidence}%</span>
        </div>
      </div>

      {/* Reasons List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted, #888)' }}>
          Signals & Reasons
        </span>
        {reasons.length === 0 ? (
          <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-secondary, #aaa)' }}>
            No anomalous phishing or credential-harvesting indicators found.
          </div>
        ) : (
          reasons.map((r, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 10px',
              background: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-primary, #ddd)'
            }}>
              <span style={{ color: levelColor, flexShrink: 0 }}>•</span>
              <span>{r}</span>
            </div>
          ))
        )}
      </div>

      {/* Signal Breakdown Table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted, #888)' }}>
          Security Posture Signals
        </span>
        <div style={{
          display: 'flex', flexDirection: 'column',
          background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border, rgba(255,255,255,0.08))',
          borderRadius: '8px', overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-secondary, #aaa)' }}>Connection Protocol</span>
            <span style={{ fontWeight: 600, color: isHttps ? '#00ffd2' : '#ff3b30' }}>
              {isHttps ? 'HTTPS Encrypted' : 'Unencrypted HTTP'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-secondary, #aaa)' }}>Credential Inputs</span>
            <span style={{ fontWeight: 600, color: verdict?.features?.hasPasswordInput ? '#ffb300' : '#00ffd2' }}>
              {verdict?.features?.hasPasswordInput ? 'Password Input Present' : 'No Password Inputs'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-secondary, #aaa)' }}>External Iframes</span>
            <span style={{ fontWeight: 600, color: (verdict?.features?.iframeHiddenCount ?? 0) > 0 ? '#ffb300' : '#00ffd2' }}>
              {(verdict?.features?.iframeHiddenCount ?? 0) > 0 ? `${verdict.features.iframeHiddenCount} Hidden Iframes` : 'None Detected'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-secondary, #aaa)' }}>AI Model Evaluator</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary, #fff)', fontFamily: 'monospace' }}>
              {verdict?.model || 'nemotron-3.5-bolt-e4b'}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
        <button
          onClick={onRescan}
          disabled={scanning}
          style={{
            flex: 1, padding: '10px', background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--panel-border, rgba(255,255,255,0.1))',
            borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          {scanning ? 'Scanning...' : 'Rescan Site'}
        </button>

        <button
          onClick={handleTrust}
          disabled={trusted}
          style={{
            flex: 1, padding: '10px',
            background: trusted ? 'rgba(0,255,210,0.1)' : 'rgba(36,82,255,0.2)',
            border: trusted ? '1px solid #00ffd2' : '1px solid rgba(36,82,255,0.5)',
            borderRadius: '6px', color: trusted ? '#00ffd2' : '#fff', fontSize: '12px', fontWeight: 600, cursor: trusted ? 'default' : 'pointer',
          }}
        >
          {trusted ? '✓ Added to Trusted' : 'Trust this site'}
        </button>
      </div>
    </div>
  );
}

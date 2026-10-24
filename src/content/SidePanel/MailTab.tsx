import React, { useState } from 'react';

interface MailTabProps {
  isGmail: boolean;
  mailSummary: any;
  deepVerdict: any;
  onRescanMail: () => void;
  scanning: boolean;
}

export default function MailTab({
  isGmail,
  mailSummary,
  deepVerdict,
  onRescanMail,
  scanning,
}: MailTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!isGmail) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '32px 20px', gap: '16px', textAlign: 'center', flex: 1,
      }}>
        <div style={{ fontSize: '36px' }}>✉️</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>Gmail Guard</span>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary, #aaa)', maxWidth: '280px' }}>
            Open Gmail in your browser to automatically scan your inbox and opened messages for phishing attacks.
          </span>
        </div>
        <button
          onClick={() => window.open('https://mail.google.com', '_blank')}
          style={{
            padding: '10px 20px', background: 'rgba(36,82,255,0.2)',
            border: '1px solid rgba(36,82,255,0.6)', borderRadius: '8px',
            color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          Open Gmail →
        </button>
      </div>
    );
  }

  const scannedCount = mailSummary?.scannedCount ?? 0;
  const flaggedCount = mailSummary?.flaggedCount ?? 0;
  const flagged = (mailSummary?.flagged || []).slice().sort((a: any, b: any) => {
    if (a.level === 'high' && b.level !== 'high') return -1;
    if (a.level !== 'high' && b.level === 'high') return 1;
    return 0;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', overflowY: 'auto', flex: 1 }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', background: 'rgba(255,255,255,0.03)',
        borderRadius: '8px', border: '1px solid var(--panel-border, rgba(255,255,255,0.08))',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Gmail Guard</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted, #888)' }}>
            {scannedCount} emails scanned · {flaggedCount} flagged
          </span>
        </div>
        <button
          onClick={onRescanMail}
          disabled={scanning}
          style={{
            padding: '6px 12px', background: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--panel-border, rgba(255,255,255,0.12))',
            borderRadius: '6px', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          {scanning ? 'Scanning...' : 'Rescan Inbox'}
        </button>
      </div>

      {/* Deep scan section if email open */}
      {deepVerdict && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px',
          background: deepVerdict.level === 'dangerous' ? 'rgba(255,59,48,0.1)' : deepVerdict.level === 'suspicious' ? 'rgba(255,149,0,0.1)' : 'rgba(0,255,210,0.08)',
          border: `1px solid ${deepVerdict.level === 'dangerous' ? '#ff3b30' : deepVerdict.level === 'suspicious' ? '#ff9500' : '#00ffd2'}40`,
          borderRadius: '8px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: deepVerdict.level === 'dangerous' ? '#ff3b30' : '#ffb300' }}>
              Deep Scan: {deepVerdict.level.toUpperCase()}
            </span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>
              {Math.round(deepVerdict.confidence * 100)}% Confidence
            </span>
          </div>

          {deepVerdict.attackType && deepVerdict.attackType !== 'none' && (
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>
              Attack Type: {deepVerdict.attackType.replace(/_/g, ' ')}
            </span>
          )}

          {deepVerdict.reasons?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
              {deepVerdict.reasons.map((r: string, idx: number) => (
                <div key={idx} style={{ fontSize: '11px', color: 'var(--text-secondary, #ccc)' }}>
                  • {r}
                </div>
              ))}
            </div>
          )}

          {deepVerdict.advice && (
            <div style={{ fontSize: '11px', fontStyle: 'italic', color: '#00ffd2', marginTop: '4px' }}>
              Recommendation: {deepVerdict.advice}
            </div>
          )}
        </div>
      )}

      {/* Flagged Emails List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted, #888)' }}>
          Flagged Emails ({flagged.length})
        </span>

        {flagged.length === 0 ? (
          <div style={{ padding: '16px', background: 'rgba(0,255,210,0.05)', borderRadius: '8px', border: '1px solid rgba(0,255,210,0.15)', color: '#00ffd2', fontSize: '12px', textAlign: 'center' }}>
            ✓ No suspicious emails detected in the latest 50 inbox rows.
          </div>
        ) : (
          flagged.map((item: any) => {
            const isExp = expandedId === item.rowId;
            const isHigh = item.level === 'high';
            return (
              <div
                key={item.rowId}
                style={{
                  display: 'flex', flexDirection: 'column',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--panel-border, rgba(255,255,255,0.08))',
                  borderRadius: '8px', overflow: 'hidden',
                }}
              >
                <div
                  onClick={() => setExpandedId(isExp ? null : item.rowId)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.sender || 'Unknown Sender'}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary, #aaa)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.subject || 'No Subject'}
                    </span>
                  </div>

                  <span style={{
                    fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
                    padding: '3px 7px', borderRadius: '4px',
                    background: isHigh ? 'rgba(255,59,48,0.2)' : 'rgba(255,149,0,0.2)',
                    color: isHigh ? '#ff3b30' : '#ff9500',
                    border: `1px solid ${isHigh ? '#ff3b30' : '#ff9500'}60`,
                    flexShrink: 0, marginLeft: '8px',
                  }}>
                    {item.level}
                  </span>
                </div>

                {isExp && (
                  <div style={{
                    padding: '10px 12px', background: 'rgba(0,0,0,0.2)',
                    borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '11px',
                    color: 'var(--text-secondary, #ddd)', display: 'flex', flexDirection: 'column', gap: '6px',
                  }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary, #fff)' }}>Threat Analysis:</span>
                    <span>{item.reason}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

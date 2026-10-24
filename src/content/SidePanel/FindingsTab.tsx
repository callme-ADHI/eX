import React, { useState } from 'react';

interface FindingsTabProps {
  findings: any[];
  isLocalhost: boolean;
  scanningActive: boolean;
  onRunActiveScan: () => void;
  onExplainWithAI: (finding: any) => void;
}

type SeverityFilter = 'all' | 'high' | 'medium' | 'low' | 'info';

export default function FindingsTab({
  findings,
  isLocalhost,
  scanningActive,
  onRunActiveScan,
  onExplainWithAI,
}: FindingsTabProps) {
  const [filter, setFilter] = useState<SeverityFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = findings.filter((f) => {
    if (filter === 'all') return true;
    if (filter === 'high') return f.severity === 'high' || f.severity === 'critical';
    return f.severity === filter;
  });

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'critical':
      case 'high':
        return '#ff3b30';
      case 'medium':
        return '#ff9500';
      case 'low':
        return '#00ffd2';
      default:
        return '#8e8e93';
    }
  };

  const handleExportMarkdown = () => {
    const lines = [
      `# eX Cyber Security Findings Report`,
      `*Generated on ${new Date().toISOString()}*`,
      ``,
      `## Summary`,
      `- Total Findings: ${findings.length}`,
      `- High / Critical: ${findings.filter(f => f.severity === 'high' || f.severity === 'critical').length}`,
      `- Medium: ${findings.filter(f => f.severity === 'medium').length}`,
      `- Low / Info: ${findings.filter(f => f.severity === 'low' || f.severity === 'info').length}`,
      ``,
      `---`,
      `## Findings Details`,
      ``,
    ];

    findings.forEach((f, i) => {
      lines.push(`### ${i + 1}. [${f.severity.toUpperCase()}] ${f.title}`);
      lines.push(`- **Mode:** ${f.mode}`);
      if (f.url) lines.push(`- **Target URL:** ${f.url}`);
      lines.push(`- **Evidence:** \`${f.evidence}\``);
      if (f.explanation) lines.push(`- **Explanation:** ${f.explanation}`);
      if (f.fix) lines.push(`- **Remediation:** ${f.fix}`);
      lines.push(``);
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eX-security-report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px', overflowY: 'auto', flex: 1 }}>
      {/* Localhost Active Scan Hero Button */}
      {isLocalhost && (
        <div style={{
          padding: '14px', borderRadius: '8px',
          background: 'rgba(0,255,210,0.06)', border: '1px solid rgba(0,255,210,0.25)',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#00ffd2' }}>Localhost Active Vulnerability Engine</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted, #aaa)' }}>Safe Probes</span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary, #ccc)' }}>
            Probe common developer misconfigurations (exposed /.env, /.git repository, open admin status endpoints).
          </span>
          <button
            onClick={onRunActiveScan}
            disabled={scanningActive}
            style={{
              padding: '8px 14px', background: scanningActive ? 'rgba(255,255,255,0.08)' : 'rgba(0,255,210,0.18)',
              border: '1px solid rgba(0,255,210,0.5)', borderRadius: '6px',
              color: scanningActive ? '#aaa' : '#00ffd2', fontSize: '12px', fontWeight: 700,
              cursor: scanningActive ? 'default' : 'pointer', transition: 'all 0.15s',
            }}
          >
            {scanningActive ? 'Active Probe Running...' : '⚡ Run Active Safe Probes Now'}
          </button>
        </div>
      )}

      {/* Filter Chips and Export Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {(['all', 'high', 'medium', 'low', 'info'] as SeverityFilter[]).map((sev) => {
            const active = filter === sev;
            return (
              <button
                key={sev}
                onClick={() => setFilter(sev)}
                style={{
                  padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                  textTransform: 'uppercase', cursor: 'pointer',
                  background: active ? 'rgba(36,82,255,0.25)' : 'rgba(255,255,255,0.03)',
                  border: active ? '1px solid #2452ff' : '1px solid var(--panel-border, rgba(255,255,255,0.08))',
                  color: active ? '#fff' : 'var(--text-muted, #888)',
                }}
              >
                {sev}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleExportMarkdown}
          disabled={findings.length === 0}
          style={{
            padding: '5px 10px', background: 'transparent',
            border: '1px solid var(--panel-border, rgba(255,255,255,0.12))',
            borderRadius: '4px', color: 'var(--text-secondary, #ccc)',
            fontSize: '11px', fontWeight: 600, cursor: findings.length === 0 ? 'default' : 'pointer',
          }}
        >
          Export (.md)
        </button>
      </div>

      {/* Findings List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-muted, #888)', fontSize: '12px' }}>
            No findings matching current filter.
          </div>
        ) : (
          filtered.map((f) => {
            const isExp = expandedId === f.id;
            const color = getSeverityColor(f.severity);
            return (
              <div
                key={f.id}
                style={{
                  display: 'flex', flexDirection: 'column',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--panel-border, rgba(255,255,255,0.08))',
                  borderRadius: '8px', overflow: 'hidden',
                }}
              >
                <div
                  onClick={() => setExpandedId(isExp ? null : f.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', cursor: 'pointer', gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <span style={{
                      fontSize: '9px', fontWeight: 800, textTransform: 'uppercase',
                      padding: '2px 6px', borderRadius: '3px',
                      background: `${color}20`, color, border: `1px solid ${color}40`,
                      flexShrink: 0,
                    }}>
                      {f.severity}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {f.title}
                    </span>
                  </div>

                  <span style={{
                    fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
                    color: f.mode === 'active' ? '#00ffd2' : 'var(--text-muted, #777)',
                    flexShrink: 0,
                  }}>
                    {f.mode}
                  </span>
                </div>

                {isExp && (
                  <div style={{
                    padding: '12px', background: 'rgba(0,0,0,0.25)',
                    borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex',
                    flexDirection: 'column', gap: '8px', fontSize: '12px',
                  }}>
                    {/* Evidence Box */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted, #888)' }}>
                        Observed Evidence:
                      </span>
                      <pre style={{
                        margin: 0, padding: '8px 10px', background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px',
                        fontFamily: 'monospace', fontSize: '11px', color: '#00ffd2', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                      }}>
                        {f.evidence}
                      </pre>
                    </div>

                    {f.explanation && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted, #888)' }}>
                          Vulnerability Impact:
                        </span>
                        <span style={{ color: 'var(--text-secondary, #ccc)' }}>{f.explanation}</span>
                      </div>
                    )}

                    {f.fix && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#00ffd2' }}>
                          Remediation Fix:
                        </span>
                        <span style={{ color: '#fff' }}>{f.fix}</span>
                      </div>
                    )}

                    <button
                      onClick={() => onExplainWithAI(f)}
                      style={{
                        marginTop: '4px', alignSelf: 'flex-start',
                        padding: '6px 12px', background: 'rgba(36,82,255,0.2)',
                        border: '1px solid rgba(36,82,255,0.5)', borderRadius: '4px',
                        color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      💬 Explain with AI
                    </button>
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

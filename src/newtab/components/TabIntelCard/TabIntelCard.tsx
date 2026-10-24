import React, { useState } from 'react';
import { useStorage } from '../../hooks/useStorage';
import { KEYS } from '../../../shared/storage';
import { sendMessage } from '../../../shared/messaging';
import type { TabSnapshot, SecurityReport, WeeklyTabAnalysis } from '../../../shared/types';
import styles from './TabIntelCard.module.css';

const getDayName = (dateStr: string | null) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString(undefined, { weekday: 'long' });
  } catch {
    return 'N/A';
  }
};

const blockBar = (percentage: number) => {
  const filledCount = Math.min(10, Math.round(percentage / 10)); // 10 blocks max
  const unfilledCount = Math.max(0, 10 - filledCount);
  return '█'.repeat(filledCount) + '░'.repeat(unfilledCount);
};

export default function TabIntelCard() {
  const [snap] = useStorage<TabSnapshot | null>(KEYS.TAB_SNAPSHOT, null);
  const [securityCache] = useStorage<Record<string, SecurityReport> | null>(KEYS.SECURITY_CACHE, {});
  const [analysis] = useStorage<WeeklyTabAnalysis | null>(KEYS.WEEK_ANALYSIS, null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTabSub, setActiveTabSub] = useState<'week' | 'active'>('week');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleTabsCount, setVisibleTabsCount] = useState(8);

  const hasValidSnap = !!(snap && Array.isArray(snap.tabs) && snap.byCategory && snap.topDomains);
  const hasValidAnalysis = !!(analysis && Array.isArray(analysis.topDomains) && Array.isArray(analysis.categoryBreakdown));
  const dupes = hasValidSnap ? (snap.duplicates?.reduce((n, d) => n + (d?.tabIds?.length ?? 1) - 1, 0) ?? 0) : 0;

  const closeDupes = async (tabIds: number[]) => {
    if (!Array.isArray(tabIds)) return;
    const [, ...toClose] = tabIds;
    if (toClose.length) await sendMessage({ type: 'CLOSE_TABS', tabIds: toClose });
  };

  const formatClockTime = (ts: any) => {
    if (!ts || isNaN(new Date(ts).getTime())) return 'N/A';
    const dateObj = new Date(ts);
    const diffMs = Date.now() - dateObj.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    try {
      const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      if (diffDays <= 0) {
        return timeStr;
      } else if (diffDays === 1) {
        return `${timeStr} (Yesterday)`;
      } else {
        return `${timeStr} (${diffDays}d ago)`;
      }
    } catch {
      return 'N/A';
    }
  };

  const formatDuration = (ms: any) => {
    const val = Number(ms);
    if (isNaN(val) || val <= 0) return '0s';
    const s = Math.floor(val / 1000);
    const m = Math.floor(s / 60);
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  };

  const getSecurityVerdict = (domain: string): string => {
    if (!securityCache || typeof securityCache !== 'object') return 'Unknown';
    const match = securityCache[`https://${domain}`] || securityCache[`http://${domain}`] || securityCache[domain];
    if (!match) return 'Unknown';
    const v = match.verdict || match.riskLevel || 'Unknown';
    return typeof v === 'string' ? v : 'Unknown';
  };

  const getVerdictClass = (verdict: string) => {
    if (verdict === 'Safe') return styles.verdictSafe;
    if (verdict === 'Medium Risk') return styles.verdictMedium;
    if (verdict === 'High Risk') return styles.verdictHigh;
    return styles.verdictUnknown;
  };

  return (
    <div className={`${styles.card} ${isExpanded ? styles.expanded : ''}`}>
      {/* Header */}
      <div className={styles.header} onClick={() => setIsExpanded(!isExpanded)}>
        <div className={styles.titleGroup}>
          <svg className={styles.sparkleIcon} viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span className={styles.title}>TAB INTELLIGENCE</span>
        </div>
        <div className={styles.headerRight}>
          {hasValidSnap && <span className={styles.tabCountBadge}>{snap.totalTabs} open</span>}
          <button className={`${styles.expandBtn} ${isExpanded ? styles.rotated : ''}`}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {hasValidSnap ? (
        <div className={styles.body}>
          {/* Collapsed Category Summary */}
          {!isExpanded && (
            <div className={styles.collapsedSummary} onClick={() => setIsExpanded(!isExpanded)}>
              <div className={styles.cats}>
                {Object.entries(snap.byCategory).slice(0, 3).map(([cat, count]) => {
                  const pct = snap.totalTabs > 0 ? (count / snap.totalTabs) * 100 : 0;
                  return (
                    <div key={cat} className={styles.catRow}>
                      <span className={styles.catName}>{cat}</span>
                      <div className={styles.barTrack}>
                        <div className={styles.barFill} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={styles.catCount}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Expanded detailed tab items / analysis */}
          {isExpanded && (
            <div className={styles.expandedContent}>
              {/* Tabs for Sub-views */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px', marginBottom: '8px' }}>
                <button 
                  onClick={() => setActiveTabSub('week')}
                  style={{
                    background: activeTabSub === 'week' ? 'rgba(0, 255, 210, 0.08)' : 'transparent',
                    border: '1px solid ' + (activeTabSub === 'week' ? 'rgba(0, 255, 210, 0.3)' : 'rgba(255,255,255,0.05)'),
                    color: activeTabSub === 'week' ? '#00ffd2' : 'rgba(255,255,255,0.5)',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  7-DAY WEEKLY REPORT
                </button>
                <button 
                  onClick={() => setActiveTabSub('active')}
                  style={{
                    background: activeTabSub === 'active' ? 'rgba(0, 255, 210, 0.08)' : 'transparent',
                    border: '1px solid ' + (activeTabSub === 'active' ? 'rgba(0, 255, 210, 0.3)' : 'rgba(255,255,255,0.05)'),
                    color: activeTabSub === 'active' ? '#00ffd2' : 'rgba(255,255,255,0.5)',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  ACTIVE SESSIONS
                </button>
              </div>

              {activeTabSub === 'week' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {hasValidAnalysis ? (
                    <>
                      {/* Overview metrics */}
                      <div style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '10px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', marginBottom: '4px' }}>
                          TAB INTELLIGENCE — LAST 7 DAYS
                        </div>
                        <div>  Total browsing time    {analysis.totalSessionTime}</div>
                        <div>  Domains visited        {analysis.totalDomains}</div>
                        <div>  Most productive day    {getDayName(analysis.mostProductiveDay)}</div>
                      </div>

                      {/* Category breakdown with monospace progress bars */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div className={styles.subTitle}>CATEGORY BREAKDOWN</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.4', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          {analysis.categoryBreakdown.slice(0, 5).map((cat) => (
                            <div key={cat.category} style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'nowrap' }}>
                              <span style={{ color: 'rgba(255,255,255,0.75)', minWidth: '95px', display: 'inline-block' }}>{cat.category}</span>
                              <span style={{ color: 'var(--accent)', letterSpacing: '1px' }}>{blockBar(cat.percentage)}</span>
                              <span style={{ color: 'rgba(255,255,255,0.4)', minWidth: '35px', textAlign: 'right', display: 'inline-block' }}>{cat.percentage}%</span>
                              <span style={{ color: 'rgba(255,255,255,0.6)', minWidth: '55px', textAlign: 'right', display: 'inline-block' }}>{cat.durationFormatted}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Top sites this week */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div className={styles.subTitle}>TOP SITES THIS WEEK</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {analysis.topDomains.slice(0, 5).map((site, i) => (
                            <div key={site.domain} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '6px 8px', borderRadius: '4px', fontSize: '11px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                                <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>{i + 1}.</span>
                                <span style={{ color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={site.domain}>{site.domain}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>
                                <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{site.durationFormatted}</span>
                                <span>·</span>
                                <span style={{ textTransform: 'capitalize' }}>{site.category}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className={styles.empty}>Tab analysis processing... Check back in a few minutes.</div>
                  )}
                </div>
              )}

              {activeTabSub === 'active' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className={styles.subTitle}>ACTIVE TAB TELEMETRY</div>
                    {snap.tabs.length > 8 && (
                      <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                        Showing {Math.min(visibleTabsCount, snap.tabs.length)} of {snap.totalTabs}
                      </span>
                    )}
                  </div>

                  {/* Search box for filtering when many tabs are open */}
                  <div style={{ marginBottom: '10px' }}>
                    <input
                      type="text"
                      placeholder="Search tabs by title or domain..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setVisibleTabsCount(8); // Reset pagination count on search
                      }}
                      style={{
                        width: '100%',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        color: '#fff',
                        fontSize: '11px',
                        outline: 'none',
                        transition: 'all 0.15s ease',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div className={styles.tabList}>
                    {(() => {
                      const filtered = snap.tabs.filter((t) => {
                        if (!t) return false;
                        const q = searchQuery.toLowerCase().trim();
                        if (!q) return true;
                        return (
                          (t.title || '').toLowerCase().includes(q) ||
                          (t.domain || '').toLowerCase().includes(q)
                        );
                      });

                      // Sort by activeDurationMs descending (most active tabs first)
                      const sorted = [...filtered].sort(
                        (a, b) => (b.activeDurationMs || 0) - (a.activeDurationMs || 0)
                      );

                      const paginated = sorted.slice(0, visibleTabsCount);

                      if (sorted.length === 0) {
                        return <div className={styles.empty}>No tabs matching your search.</div>;
                      }

                      return (
                        <>
                          {paginated.map((t) => {
                            if (!t) return null;
                            const verdict = getSecurityVerdict(t.domain || '');
                            return (
                              <div key={t.tabId} className={styles.tabRow}>
                                <div className={styles.tabMetaCol}>
                                  <div className={styles.tabTitle} title={t.title || ''}>{t.title || 'New Tab'}</div>
                                  <div className={styles.tabDomainGroup}>
                                    <span className={styles.tabDomain}>{t.domain || 'system'}</span>
                                    <span className={`${styles.verdictBadge} ${getVerdictClass(verdict)}`}>
                                      {verdict ? String(verdict).toUpperCase() : 'UNKNOWN'}
                                    </span>
                                  </div>
                                  <div className={styles.timeGroup}>
                                    <span className={styles.timeLabel}>Clock:</span>
                                    <span className={styles.timeVal}>{formatClockTime(t.openedAt || Date.now())}</span>
                                    <span className={styles.divider}>·</span>
                                    <span className={styles.timeLabel}>Usage:</span>
                                    <span className={styles.timeVal}>{formatDuration(t.activeDurationMs || 0)}</span>
                                  </div>
                                </div>

                                {/* Counts / Permissions panel */}
                                <div className={styles.permissionsCol}>
                                  <div className={styles.permIndicator} title="Camera accesses" style={{ color: (t.cameraAccessCount ?? 0) > 0 ? '#22c55e' : 'rgba(255,255,255,0.2)' }}>
                                    🎥 <span>{t.cameraAccessCount ?? 0}</span>
                                  </div>
                                  <div className={styles.permIndicator} title="Microphone accesses" style={{ color: (t.micAccessCount ?? 0) > 0 ? '#22c55e' : 'rgba(255,255,255,0.2)' }}>
                                    🎙️ <span>{t.micAccessCount ?? 0}</span>
                                  </div>
                                  <div className={styles.permIndicator} title="Network fetch calls" style={{ color: (t.fetchCount ?? 0) > 0 ? '#00ffd2' : 'rgba(255,255,255,0.2)' }}>
                                    ⚡ <span>{t.fetchCount ?? 0}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {sorted.length > visibleTabsCount && (
                            <button
                              onClick={() => setVisibleTabsCount((prev) => prev + 10)}
                              style={{
                                width: '100%',
                                background: 'rgba(0, 255, 210, 0.06)',
                                border: '1px solid rgba(0, 255, 210, 0.2)',
                                color: '#00ffd2',
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '8px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                marginTop: '4px',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              SHOW MORE TABS (+{sorted.length - visibleTabsCount} remaining)
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Duplicate alerts */}
                  {dupes > 0 && snap.duplicates && (
                    <div className={styles.dupesSection}>
                      <div className={styles.subTitle}>DUPLICATE ALERTS</div>
                      {snap.duplicates.map((d, i) => {
                        if (!d) return null;
                        let label = d.url;
                        try { label = new URL(d.url).hostname; } catch {}
                        return (
                          <div key={i} className={styles.dupeRow}>
                            <div className={styles.dupeInfo}>
                              <span className={styles.dupeDomain}>{label}</span>
                              <span className={styles.dupeCount}>({d.tabIds?.length ?? 0} open)</span>
                            </div>
                            <button className={styles.dupeBtn} onClick={() => closeDupes(d.tabIds)}>
                              CLOSE DUPES
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Footer top domain (collapsed only) */}
          {!isExpanded && snap.topDomains.length > 0 && (
            <div className={styles.topDomain}>
              <span className={styles.topLabel}>Most visited:</span>
              <span className={styles.topVal}>{snap.topDomains[0]?.domain || ''}</span>
              <span className={styles.topCount}>{snap.topDomains[0]?.visitCount ?? 0}×</span>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.empty}>Start browsing to populate tab analytics.</div>
      )}
    </div>
  );
}

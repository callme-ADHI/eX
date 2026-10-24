import React, { useState } from 'react';
import { useStorage } from '../../hooks/useStorage';
import { KEYS } from '../../../shared/storage';
import { isProductive, isDistracting } from '../../../shared/utils';
import type { ProductivityRollup, TabSnapshot } from '../../../shared/types';
import styles from './ProductivityCard.module.css';

export default function ProductivityCard() {
  const [daily]  = useStorage<ProductivityRollup | null>(KEYS.ROLLUP_DAILY,  null);
  const [weekly] = useStorage<ProductivityRollup | null>(KEYS.ROLLUP_WEEKLY, null);
  const [snap]   = useStorage<TabSnapshot | null>(KEYS.TAB_SNAPSHOT, null);
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily');
  const [isExpanded, setIsExpanded] = useState(false);

  const rollup = period === 'daily' ? daily : weekly;

  const fmtH = (ms: number) => {
    const m = Math.floor(ms / 60000);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    return `${m}m`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22c55e'; // Green
    if (score >= 50) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  // Group tabs by category classification
  const tabs = snap?.tabs ?? [];
  const productiveTabs = tabs
    .filter(t => isProductive(t.category) && t.activeDurationMs > 0)
    .sort((a, b) => b.activeDurationMs - a.activeDurationMs);
  const distractingTabs = tabs
    .filter(t => isDistracting(t.category) && t.activeDurationMs > 0)
    .sort((a, b) => b.activeDurationMs - a.activeDurationMs);

  return (
    <div className={`${styles.card} ${isExpanded ? styles.expanded : ''}`}>
      {/* Header */}
      <div className={styles.header} onClick={() => setIsExpanded(!isExpanded)}>
        <div className={styles.titleGroup}>
          <span className={styles.pulseDot} style={{ background: rollup ? getScoreColor(rollup.score) : 'var(--text-disabled)' }} />
          <span className={styles.title}>PRODUCTIVITY PROFILE</span>
        </div>
        <div className={styles.controls} onClick={(e) => e.stopPropagation()}>
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${period === 'daily' ? styles.activeTab : ''}`} onClick={() => setPeriod('daily')}>D</button>
            <button className={`${styles.tab} ${period === 'weekly' ? styles.activeTab : ''}`} onClick={() => setPeriod('weekly')}>W</button>
          </div>
          <button className={`${styles.expandBtn} ${isExpanded ? styles.rotated : ''}`} onClick={() => setIsExpanded(!isExpanded)}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {rollup ? (
        <div className={styles.body}>
          {/* Collapsed view summary */}
          <div className={styles.row} onClick={() => setIsExpanded(!isExpanded)}>
            {/* Score circle */}
            <div className={styles.scoreCircle}>
              <svg viewBox="0 0 60 60" className={styles.scoreSvg}>
                <circle cx="30" cy="30" r="26" className={styles.scoreTrack} />
                <circle
                  cx="30" cy="30" r="26"
                  className={styles.scoreArc}
                  stroke={getScoreColor(rollup.score)}
                  strokeDasharray={`${(rollup.score / 100) * 163.4} 163.4`}
                  strokeDashoffset="0"
                  transform="rotate(-90 30 30)"
                />
              </svg>
              <span className={styles.scoreNum} style={{ color: getScoreColor(rollup.score) }}>{rollup.score}</span>
            </div>

            {/* Key stats */}
            <div className={styles.stats}>
              <div className={styles.statRow}>
                <span className={styles.statDot} style={{ background: '#22c55e' }} />
                <span className={styles.statLabel}>Productive</span>
                <span className={styles.statVal}>{fmtH(rollup.productiveMs)}</span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statDot} style={{ background: '#ef4444' }} />
                <span className={styles.statLabel}>Distracting</span>
                <span className={styles.statVal} style={{ color: '#ef4444' }}>{fmtH(rollup.distractingMs)}</span>
              </div>
            </div>
          </div>

          {/* Expanded view detailed content */}
          {isExpanded && (
            <div className={styles.expandedContent}>
              {/* Factors list */}
              {(rollup.positiveFactors.length > 0 || rollup.negativeFactors.length > 0) && (
                <div className={styles.factorsList}>
                  <div className={styles.subTitle}>SCORE FACTORS</div>
                  {rollup.positiveFactors.map((f, i) => (
                    <div key={`pos-${i}`} className={styles.factorItem}>
                      <span className={styles.factorText}>🟢 {f.label}</span>
                      <span className={styles.factorVal} style={{ color: '#22c55e' }}>+{f.contribution}</span>
                    </div>
                  ))}
                  {rollup.negativeFactors.map((f, i) => (
                    <div key={`neg-${i}`} className={styles.factorItem}>
                      <span className={styles.factorText}>🔴 {f.label}</span>
                      <span className={styles.factorVal} style={{ color: '#ef4444' }}>{f.contribution}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Productive Site Details */}
              {productiveTabs.length > 0 && (
                <div className={styles.siteSection}>
                  <div className={styles.subTitle}>PRODUCTIVE WEBSITES</div>
                  <div className={styles.siteList}>
                    {productiveTabs.slice(0, 4).map((t) => (
                      <div key={t.tabId} className={styles.siteRow}>
                        <div className={styles.siteInfo}>
                          <span className={styles.siteDot} style={{ background: '#22c55e' }} />
                          <span className={styles.siteTitle} title={t.title}>{t.title}</span>
                        </div>
                        <span className={styles.siteTime}>{fmtH(t.activeDurationMs)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Distracting Site Details */}
              {distractingTabs.length > 0 && (
                <div className={styles.siteSection}>
                  <div className={styles.subTitle}>DISTRACTING WEBSITES</div>
                  <div className={styles.siteList}>
                    {distractingTabs.slice(0, 4).map((t) => (
                      <div key={t.tabId} className={styles.siteRow}>
                        <div className={styles.siteInfo}>
                          <span className={styles.siteDot} style={{ background: '#ef4444' }} />
                          <span className={styles.siteTitle} title={t.title}>{t.title}</span>
                        </div>
                        <span className={styles.siteTime} style={{ color: '#ef4444' }}>{fmtH(t.activeDurationMs)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {productiveTabs.length === 0 && distractingTabs.length === 0 && (
                <div className={styles.emptyDetails}>No active website usage recorded yet.</div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className={styles.empty}>Start browsing to generate your productivity profile.</div>
      )}
    </div>
  );
}

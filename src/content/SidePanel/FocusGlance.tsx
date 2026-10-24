import React, { useState, useEffect } from 'react';
import { sendMessage } from '../../shared/messaging';
import type { FocusSession, FocusCategory } from '../../shared/types';
import styles from './SidePanel.module.css';

interface Props {
  session: FocusSession | null;
}

export default function FocusGlance({ session }: Props) {
  const [timeLeft, setTimeLeft] = useState(0);

  // Form states for starting a session
  const [goal, setGoal] = useState('');
  const [category, setCategory] = useState<FocusCategory>('Coding');
  const [duration, setDuration] = useState(25);
  const [customDuration, setCustomDuration] = useState('');
  const [isCustomTime, setIsCustomTime] = useState(false);

  useEffect(() => {
    if (!session || session.status !== 'active') return;
    const updateTime = () => {
      const elapsed = Date.now() - session.startedAt;
      const total = session.durationMinutes * 60 * 1000;
      setTimeLeft(Math.max(0, total - elapsed));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [session]);

  const handlePauseResume = () => {
    if (!session) return;
    if (session.status === 'active') {
      sendMessage({ type: 'PAUSE_FOCUS_SESSION', id: session.id });
    } else {
      sendMessage({ type: 'RESUME_FOCUS_SESSION', id: session.id });
    }
  };

  const handleCancel = () => {
    if (!session) return;
    sendMessage({ type: 'CANCEL_FOCUS_SESSION', id: session.id });
  };

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;

    const sessionMinutes = isCustomTime ? parseInt(customDuration) || 25 : duration;
    await sendMessage({
      type: 'START_FOCUS_SESSION',
      session: {
        goal: goal.trim(),
        category,
        durationMinutes: sessionMinutes,
        endedAt: null
      }
    });
    setGoal('');
  };

  const formatMs = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isActive = session && (session.status === 'active' || session.status === 'paused');

  return (
    <div className={styles.sectionWrapper}>
      <div className={styles.sectionHeader}>FOCUS TIMER</div>

      {isActive ? (
        <div className={styles.activeFocus}>
          <div className={styles.timeValue}>{formatMs(timeLeft)}</div>
          <div className={styles.focusGoal}>"{session.goal}"</div>
          <div className={styles.focusMeta}>
            <span className={styles.categoryTag}>{session.category}</span>
            {session.distractionAttempts > 0 && (
              <span className={styles.warningTag}>Distractions: {session.distractionAttempts}</span>
            )}
          </div>

          <div className={styles.actions}>
            <button onClick={handlePauseResume} className={styles.actionBtn}>
              {session.status === 'active' ? 'PAUSE' : 'RESUME'}
            </button>
            <button onClick={handleCancel} className={`${styles.actionBtn} ${styles.cancelBtn}`}>
              CANCEL
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleStartSession} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Focus Objective
            </label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What are we locking in on?"
              required
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '4px',
                padding: '6px 8px',
                color: '#fff',
                fontSize: '11px',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Category
            </label>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {(['Coding', 'Study', 'Research', 'Reading', 'Writing'] as FocusCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  style={{
                    background: category === cat ? 'rgba(36, 82, 255, 0.15)' : 'rgba(255,255,255,0.02)',
                    border: '1px solid',
                    borderColor: category === cat ? 'var(--ex1-accent, #2452FF)' : 'rgba(255,255,255,0.08)',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    color: category === cat ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                    fontSize: '10px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Duration
            </label>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {([15, 25, 45, 60] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setDuration(t);
                    setIsCustomTime(false);
                  }}
                  style={{
                    flex: 1,
                    background: !isCustomTime && duration === t ? 'rgba(36, 82, 255, 0.15)' : 'rgba(255,255,255,0.02)',
                    border: '1px solid',
                    borderColor: !isCustomTime && duration === t ? 'var(--ex1-accent, #2452FF)' : 'rgba(255,255,255,0.08)',
                    borderRadius: '4px',
                    padding: '4px 0',
                    color: !isCustomTime && duration === t ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                    fontSize: '10px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {t}m
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsCustomTime(true)}
                style={{
                  flex: 1,
                  background: isCustomTime ? 'rgba(36, 82, 255, 0.15)' : 'rgba(255,255,255,0.02)',
                  border: '1px solid',
                  borderColor: isCustomTime ? 'var(--ex1-accent, #2452FF)' : 'rgba(255,255,255,0.08)',
                  borderRadius: '4px',
                  padding: '4px 0',
                  color: isCustomTime ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                  fontSize: '10px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.15s ease',
                }}
              >
                Custom
              </button>
            </div>
            {isCustomTime && (
              <input
                type="number"
                placeholder="Minutes"
                value={customDuration}
                onChange={(e) => setCustomDuration(e.target.value)}
                min="1"
                max="480"
                required
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  color: '#fff',
                  fontSize: '10px',
                  outline: 'none',
                  marginTop: '4px',
                  width: '80px',
                }}
              />
            )}
          </div>

          <button
            type="submit"
            style={{
              background: 'var(--ex1-accent, #2452FF)',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '8px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              marginTop: '4px',
              letterSpacing: '0.04em',
              transition: 'opacity 0.2s',
            }}
          >
            START FOCUS SESSION
          </button>
        </form>
      )}
    </div>
  );
}

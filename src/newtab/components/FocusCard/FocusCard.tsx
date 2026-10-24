import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useStorage } from '../../hooks/useStorage';
import { KEYS } from '../../../shared/storage';
import { sendMessage } from '../../../shared/messaging';
import type { FocusSession, FocusCategory } from '../../../shared/types';
import styles from './FocusCard.module.css';

const CATEGORIES: FocusCategory[] = ['Study', 'Coding', 'Research', 'Reading', 'Writing', 'Custom'];
const DURATION_PRESETS = [25, 50, 90];

export default function FocusCard() {
  const [currentSession] = useStorage<FocusSession | null>(KEYS.CURRENT_SESSION, null);

  const [goal, setGoal] = useState('');
  const [category, setCategory] = useState<FocusCategory>('Coding');
  const [duration, setDuration] = useState(25);
  const [customDuration, setCustomDuration] = useState('');
  const [isCustomTime, setIsCustomTime] = useState(false);

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;

    const sessionMinutes = isCustomTime ? parseInt(customDuration) || 25 : duration;
    const res = await sendMessage({
      type: 'START_FOCUS_SESSION',
      session: {
        goal: goal.trim(),
        category,
        durationMinutes: sessionMinutes,
        endedAt: null
      }
    });

    if (res.ok) {
      setGoal('');
    } else {
      console.error('[FocusCard] Failed to start focus session:', res.error);
    }
  };

  return (
    <div className={`${styles.card} glass-card`}>
      <div className={styles.header}>FOCUS SESSION</div>
      {currentSession && (currentSession.status === 'active' || currentSession.status === 'paused') ? (
        <ActiveSessionView session={currentSession} />
      ) : (
        <form onSubmit={handleStartSession} className={styles.creatorForm}>
          <div className={styles.field}>
            <label className={styles.label}>WHAT IS YOUR OBJECTIVE?</label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Implement security heuristics, write docs"
              className={styles.input}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>CATEGORY</label>
            <div className={styles.grid}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`${styles.gridBtn} ${category === cat ? styles.active : ''}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>DURATION (MINUTES)</label>
            <div className={styles.durationRow}>
              {DURATION_PRESETS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setDuration(t);
                    setIsCustomTime(false);
                  }}
                  className={`${styles.presetBtn} ${!isCustomTime && duration === t ? styles.active : ''}`}
                >
                  {t}m
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsCustomTime(true)}
                className={`${styles.presetBtn} ${isCustomTime ? styles.active : ''}`}
              >
                Custom
              </button>
              {isCustomTime && (
                <input
                  type="number"
                  placeholder="Minutes"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  className={styles.customTimeInput}
                  min="1"
                  max="480"
                  required
                />
              )}
            </div>
          </div>

          <button type="submit" className={styles.startBtn}>
            INITIATE FOCUS SESSION
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Active Session View ──────────────────────────────────────────────────────

function ActiveSessionView({ session }: { session: FocusSession }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const updateTime = () => {
      const elapsed = Date.now() - session.startedAt;
      const total = session.durationMinutes * 60 * 1000;
      const remaining = Math.max(0, total - elapsed);
      setTimeLeft(remaining);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [session]);

  const handlePauseResume = () => {
    if (session.status === 'active') {
      sendMessage({ type: 'PAUSE_FOCUS_SESSION', id: session.id });
    } else {
      sendMessage({ type: 'RESUME_FOCUS_SESSION', id: session.id });
    }
  };

  const handleCancel = () => {
    sendMessage({ type: 'CANCEL_FOCUS_SESSION', id: session.id });
  };

  // Convert milliseconds to MM:SS
  const formatMs = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // SVG circular progress calculation
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = timeLeft / (session.durationMinutes * 60 * 1000);
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className={styles.activeView}>
      <div className={styles.circleWrapper}>
        <svg className={styles.progressCircle} viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} className={styles.bgCircle} />
          <motion.circle
            cx="60"
            cy="60"
            r={radius}
            className={styles.fgCircle}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset,
            }}
          />
        </svg>
        <div className={styles.timeLabel}>{formatMs(timeLeft)}</div>
      </div>

      <div className={styles.details}>
        <div className={styles.goalText}>"{session.goal}"</div>
        <div className={styles.categoryBadge}>{session.category}</div>
        {session.distractionAttempts > 0 && (
          <div className={styles.distractionWarning}>
            Distraction attempts: {session.distractionAttempts}
          </div>
        )}
      </div>

      <div className={styles.actionsRow}>
        <button onClick={handlePauseResume} className={styles.controlBtn}>
          {session.status === 'active' ? 'PAUSE' : 'RESUME'}
        </button>
        <button onClick={handleCancel} className={`${styles.controlBtn} ${styles.cancelBtn}`}>
          CANCEL
        </button>
      </div>
    </div>
  );
}

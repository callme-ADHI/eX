import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStorage } from '../../hooks/useStorage';
import { KEYS } from '../../../shared/storage';
import { sendMessage } from '../../../shared/messaging';
import type { FocusSession } from '../../../shared/types';
import styles from './FocusStrip.module.css';

const PRESETS = [25, 50, 90];
const CATS = ['Study', 'Coding', 'Research', 'Writing'];

export default function FocusStrip() {
  const [session] = useStorage<FocusSession | null>(KEYS.CURRENT_SESSION, null);
  const isActive = session && (session.status === 'active' || session.status === 'paused');

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <AnimatePresence mode="wait">
        {isActive ? (
          <motion.div
            key="active"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <ActiveView session={session} />
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <IdleView />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Idle: compact form ─────────────────────────────────────────────────── */
function IdleView() {
  const [goal, setGoal] = useState('');
  const [cat, setCat] = useState('Coding');
  const [mins, setMins] = useState(25);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;
    await sendMessage({
      type: 'START_FOCUS_SESSION',
      session: { goal: goal.trim(), category: cat as any, durationMinutes: mins, endedAt: null },
    });
    setGoal('');
  };

  return (
    <form onSubmit={start} className={styles.strip}>
      {/* Goal input */}
      <input
        className={styles.goalInput}
        placeholder="Focus target…"
        value={goal}
        onChange={e => setGoal(e.target.value)}
        required
      />

      {/* Category chips + duration presets in one row */}
      <div className={styles.optionRow}>
        {CATS.map(c => (
          <button
            key={c} type="button"
            className={`${styles.chip} ${cat === c ? styles.chipActive : ''}`}
            onClick={() => setCat(c)}
          >{c}</button>
        ))}
        <div className={styles.sep} />
        {PRESETS.map(p => (
          <button
            key={p} type="button"
            className={`${styles.chip} ${mins === p ? styles.chipActive : ''}`}
            onClick={() => setMins(p)}
          >{p}m</button>
        ))}
      </div>

      <button type="submit" className={styles.startBtn}>
        ▶ START FOCUS
      </button>
    </form>
  );
}

/* ─── Active: countdown + controls ──────────────────────────────────────── */
function ActiveView({ session }: { session: FocusSession }) {
  const [left, setLeft] = useState(0);

  useEffect(() => {
    const calc = () => {
      const elapsed = Date.now() - session.startedAt;
      setLeft(Math.max(0, session.durationMinutes * 60_000 - elapsed));
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [session]);

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  const pct = (left / (session.durationMinutes * 60_000)) * 100;
  const isPaused = session.status === 'paused';

  return (
    <div className={styles.activeStrip}>
      {/* Goal + category */}
      <div className={styles.activeTop}>
        <span className={styles.activeCat}>{session.category}</span>
        <span className={styles.activeGoal}>"{session.goal}"</span>
      </div>

      {/* Progress bar + timer */}
      <div className={styles.progressRow}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
        <span className={styles.timer}>{fmt(left)}</span>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <button
          className={styles.ctrlBtn}
          onClick={() => sendMessage({ type: isPaused ? 'RESUME_FOCUS_SESSION' : 'PAUSE_FOCUS_SESSION', id: session.id })}
        >
          {isPaused ? '▶ RESUME' : '⏸ PAUSE'}
        </button>
        <button
          className={`${styles.ctrlBtn} ${styles.cancelBtn}`}
          onClick={() => sendMessage({ type: 'CANCEL_FOCUS_SESSION', id: session.id })}
        >
          ✕ CANCEL
        </button>
        {session.distractionAttempts > 0 && (
          <span className={styles.distract}>⚠ {session.distractionAttempts} distraction{session.distractionAttempts > 1 ? 's' : ''}</span>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { AppSettings } from '../../../shared/types';
import styles from './Clock.module.css';

interface Props { settings: AppSettings; }

export default function Clock({ settings }: Props) {
  const [now, setNow] = useState(new Date());
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      setNow(new Date());
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  return (
    <motion.div
      className={styles.wrapper}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {settings.clockStyle === 'analog'
        ? <AnalogFace now={now} />
        : <DigitalFace now={now} mode={settings.clockMode} />}
    </motion.div>
  );
}

/* ─── Digital face — large monospace display ─────────────────────────────────── */
function DigitalFace({ now, mode }: { now: Date; mode: '12h' | '24h' }) {
  const hour = mode === '24h'
    ? String(now.getHours()).padStart(2, '0')
    : String(now.getHours() % 12 || 12).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const sec = String(now.getSeconds()).padStart(2, '0');
  const ampm = mode === '12h' ? (now.getHours() >= 12 ? 'PM' : 'AM') : null;

  const greeting = (() => {
    const h = now.getHours();
    if (h < 12) return 'GOOD MORNING';
    if (h < 17) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  })();

  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  }).toUpperCase();

  return (
    <div className={styles.digital}>
      <div className={styles.greeting}>{greeting}</div>
      <div className={styles.timeRow}>
        <span className={styles.timeMain}>{hour}:{min}</span>
        <div className={styles.timeRight}>
          <span className={styles.seconds}>{sec}</span>
          {ampm && <span className={styles.ampm}>{ampm}</span>}
        </div>
      </div>
      <div className={styles.date}>{dateStr}</div>
    </div>
  );
}

/* ─── Analog face ────────────────────────────────────────────────────────────── */
function AnalogFace({ now }: { now: Date }) {
  const s = now.getSeconds() + now.getMilliseconds() / 1000;
  const m = now.getMinutes() + s / 60;
  const h = (now.getHours() % 12) + m / 60;

  const secDeg = s * 6;
  const minDeg = m * 6;
  const hrDeg  = h * 30;

  return (
    <div className={styles.analogWrapper}>
      <svg className={styles.analogSvg} viewBox="0 0 200 200">
        {Array.from({ length: 60 }, (_, i) => {
          const isMajor = i % 5 === 0;
          const angle = (i / 60) * 360;
          const r1 = isMajor ? 82 : 87;
          const r2 = 92;
          const x1 = 100 + r1 * Math.sin((angle * Math.PI) / 180);
          const y1 = 100 - r1 * Math.cos((angle * Math.PI) / 180);
          const x2 = 100 + r2 * Math.sin((angle * Math.PI) / 180);
          const y2 = 100 - r2 * Math.cos((angle * Math.PI) / 180);
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={isMajor ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)'}
              strokeWidth={isMajor ? 2 : 1} strokeLinecap="round" />
          );
        })}
        <line x1="100" y1="100"
          x2={100 + 45 * Math.sin((hrDeg * Math.PI) / 180)}
          y2={100 - 45 * Math.cos((hrDeg * Math.PI) / 180)}
          stroke="white" strokeWidth="3" strokeLinecap="round" />
        <line x1="100" y1="100"
          x2={100 + 65 * Math.sin((minDeg * Math.PI) / 180)}
          y2={100 - 65 * Math.cos((minDeg * Math.PI) / 180)}
          stroke="white" strokeWidth="2" strokeLinecap="round" />
        <line x1={100 - 15 * Math.sin((secDeg * Math.PI) / 180)}
          y1={100 + 15 * Math.cos((secDeg * Math.PI) / 180)}
          x2={100 + 75 * Math.sin((secDeg * Math.PI) / 180)}
          y2={100 - 75 * Math.cos((secDeg * Math.PI) / 180)}
          stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="100" cy="100" r="3" fill="var(--accent)" />
      </svg>
      <div className={styles.date}>
        {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
      </div>
    </div>
  );
}

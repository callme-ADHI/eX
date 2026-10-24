import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStorage } from '../../hooks/useStorage';
import { KEYS } from '../../../shared/storage';
import { DEFAULT_AI_TOOLS, DEFAULT_SETTINGS } from '../../../shared/defaults';
import type { AITool, AppSettings } from '../../../shared/types';
import styles from './AIDock.module.css';
import { IconRenderer } from '../IconRenderer';
import { playTactileTick } from '../../../shared/audio';

const TRIGGER_ZONE = 32;
const CLOSE_ZONE   = 260;

// Map animation speed setting → transition duration (ms)
const SPEED_MAP = { fast: 0.09, normal: 0.15, slow: 0.28 };

export default function AIDock() {
  const [tools, setTools]   = useStorage<AITool[]>(KEYS.AI_TOOLS, DEFAULT_AI_TOOLS);
  const [settings]          = useStorage<AppSettings>(KEYS.SETTINGS, DEFAULT_SETTINGS);
  const [open, setOpen]     = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const openRef    = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const speed = SPEED_MAP[settings?.animationSpeed ?? 'normal'];

  // Auto-sync icons on mount
  useEffect(() => {
    let changed = false;
    const updated = (tools ?? []).map(t => {
      const def = DEFAULT_AI_TOOLS.find(d => d.id === t.id);
      if (def && def.icon !== t.icon) { changed = true; return { ...t, icon: def.icon }; }
      return t;
    });
    if (changed) setTools(updated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global mousemove — the ONLY reliable way to catch left-edge hover
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (e.clientX <= TRIGGER_ZONE) {
        if (!openRef.current) {
          if (closeTimer.current) clearTimeout(closeTimer.current);
          openRef.current = true;
          setOpen(true);
        }
      } else if (e.clientX > CLOSE_ZONE && openRef.current) {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        closeTimer.current = setTimeout(() => {
          openRef.current = false;
          setOpen(false);
          setHoverIndex(null);
        }, 350);
      }
    };
    document.addEventListener('mousemove', onMove);
    return () => {
      document.removeEventListener('mousemove', onMove);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const active = [...(tools ?? [])]
    .filter(t => t.pinned !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const itemSize = 44;
  const iconSize = 20;

  // macOS magnification — exact copy from bottom Dock
  const scaleFor = (idx: number) => {
    if (hoverIndex === null) return { scale: 1.0, glowOpacity: 0 };
    const diff = Math.abs(idx - hoverIndex);
    if (diff === 0) return { scale: 1.4, glowOpacity: 0.35 };
    if (diff === 1) return { scale: 1.2, glowOpacity: 0.18 };
    if (diff === 2) return { scale: 1.05, glowOpacity: 0.06 };
    return { scale: 1.0, glowOpacity: 0 };
  };

  // Drag — same pattern as bottom Dock (live reorder on dragOver)
  const handleDragStart = (idx: number) => setDraggedIndex(idx);

  const handleDragOver = (idx: number) => {
    if (draggedIndex === null || draggedIndex === idx) return;
    const reordered = [...active];
    const [moved] = reordered.splice(draggedIndex, 1);
    reordered.splice(idx, 0, moved);
    const updated = (tools ?? []).map(t => {
      const newIdx = reordered.findIndex(r => r.id === t.id);
      return newIdx !== -1 ? { ...t, order: newIdx } : t;
    });
    setTools(updated);
    setDraggedIndex(idx);
  };

  const handleDragEnd = () => setDraggedIndex(null);

  // Click — identical to bottom Dock
  const handleClick = (tool: AITool, e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: tool.url });
    } else {
      window.open(tool.url, '_blank');
    }
  };

  return (
    // KEY FIX: this outer div handles fixed positioning + CSS centering.
    // It has pointer-events:none so it never blocks anything.
    // AnimatePresence + motion.div inside handle ONLY the slide animation.
    <div className={styles.positioner}>
      <AnimatePresence>
        {open && (
          <motion.div
            // Slide entry/exit on x axis, bottom anchored via CSS.
            className={styles.dockInner}
            initial={{ x: -120 }}
            animate={{ x: 0 }}
            exit={{ x: -120 }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
          >
            <div
              className={styles.dockContainer}
              onMouseLeave={() => setHoverIndex(null)}
              style={{
                '--item-size': `${itemSize}px`
              } as React.CSSProperties}
            >
              {active.map((tool, idx) => {
                const { scale, glowOpacity } = scaleFor(idx);
                return (
                  <div
                    key={tool.id}
                    className={styles.itemWrapper}
                    onMouseEnter={() => {
                      setHoverIndex(idx);
                      playTactileTick();
                    }}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={e => { e.preventDefault(); handleDragOver(idx); }}
                    onDragEnd={handleDragEnd}
                    style={{
                      transform: `scale(${scale})`,
                      transformOrigin: 'center left',
                      zIndex: hoverIndex === idx ? 10 : 1,
                      transition: `transform ${speed}s ease-out`,
                    }}
                  >
                    <a
                      href={tool.url}
                      className={styles.dockItem}
                      onClick={e => handleClick(tool, e)}
                      title={tool.name}
                      draggable={false}
                      style={{
                        boxShadow: glowOpacity > 0 
                          ? `0 10px 30px color-mix(in srgb, var(--accent) ${Math.min(100, glowOpacity * 250)}%, transparent), 0 0 15px color-mix(in srgb, var(--accent) ${Math.min(100, glowOpacity * 200)}%, transparent)` 
                          : undefined,
                        borderColor: glowOpacity > 0
                          ? `color-mix(in srgb, var(--accent) ${Math.min(100, glowOpacity * 250)}%, var(--border))`
                          : undefined
                      }}
                    >
                      <IconRenderer icon={tool.icon} name={tool.name} url={tool.url} size={iconSize} />
                    </a>

                    {/* Tooltip to the right, same as bottom Dock label */}
                    <AnimatePresence>
                      {hoverIndex === idx && (
                        <motion.span
                          className={styles.label}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -6 }}
                          transition={{ duration: speed * 0.8 }}
                        >
                          {tool.name}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


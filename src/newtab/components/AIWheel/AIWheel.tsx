import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStorage } from '../../hooks/useStorage';
import { KEYS } from '../../../shared/storage';
import { DEFAULT_AI_TOOLS, DEFAULT_SETTINGS } from '../../../shared/defaults';
import type { AITool, AppSettings } from '../../../shared/types';
import styles from './AIWheel.module.css';

export default function AIWheel() {
  const [tools, setTools] = useStorage<AITool[]>(KEYS.AI_TOOLS, DEFAULT_AI_TOOLS);
  const [settings] = useStorage<AppSettings>(KEYS.SETTINGS, DEFAULT_SETTINGS);
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const leaveTimer = useRef<number>(undefined as unknown as number);
  const enterTimer = useRef<number>(undefined as unknown as number);

  // Auto-sync icons with high-quality defaults
  useEffect(() => {
    let changed = false;
    const updated = tools.map(t => {
      const def = DEFAULT_AI_TOOLS.find(d => d.id === t.id);
      if (def && def.icon !== t.icon) { changed = true; return { ...t, icon: def.icon }; }
      return t;
    });
    if (changed) setTools(updated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = [...tools]
    .filter(t => t.pinned !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Ctrl+Space toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === 'Space') { e.preventDefault(); setOpen(p => !p); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const openWheel = () => {
    clearTimeout(leaveTimer.current);
    clearTimeout(enterTimer.current);
    enterTimer.current = window.setTimeout(() => setOpen(true), 80);
  };

  const closeWheel = () => {
    clearTimeout(enterTimer.current);
    leaveTimer.current = window.setTimeout(() => {
      setOpen(false);
      setHovered(null);
      setDraggingId(null);
      setDragOver(null);
    }, 400);
  };

  const cancelClose = () => clearTimeout(leaveTimer.current);

  // Drag-to-reorder handlers
  const handleDragStart = (id: string) => setDraggingId(id);
  const handleDragOver = (idx: number) => setDragOver(idx);
  const handleDrop = (targetIdx: number) => {
    if (draggingId === null) return;
    const fromIdx = active.findIndex(t => t.id === draggingId);
    if (fromIdx === -1 || fromIdx === targetIdx) return;
    const reordered = [...active];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    const updatedTools = tools.map(t => {
      const newIdx = reordered.findIndex(r => r.id === t.id);
      return newIdx !== -1 ? { ...t, order: newIdx } : t;
    });
    setTools(updatedTools);
    setDraggingId(null);
    setDragOver(null);
  };

  const handleClick = (tool: AITool, e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: tool.url });
    } else {
      window.open(tool.url, '_blank');
    }
  };

  // Semicircle math: nodes spread on a right-facing arc
  // Panel: 280px wide, 560px tall, centered at (0, 50vh)
  // Circle center: at (0, 280) in local space → screen (0, 50vh)
  const N = active.length;
  const R = 180;
  const HALF_ARC = (Math.PI / 2) - 0.3; // total arc ±80° from horizontal
  const panelH = 560;
  const CX = 0;   // circle center at panel left edge
  const CY = panelH / 2; // circle center at panel vertical center

  return (
    <>
      {/* ── Edge hover trigger — always rendered, always on top ── */}
      <div
        className={styles.trigger}
        onMouseEnter={openWheel}
        onMouseLeave={closeWheel}
        role="button"
        aria-label="Open AI tools"
      />

      <AnimatePresence>
        {open && (
          <>
            {/* Dismiss backdrop */}
            <motion.div
              className={styles.backdrop}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setOpen(false)}
            />

            {/* Main panel — slides from left, transparent container */}
            <motion.div
              className={styles.panel}
              style={{ height: panelH }}
              initial={{ x: -(R + 60) }}
              animate={{ x: 0 }}
              exit={{ x: -(R + 60) }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onMouseEnter={cancelClose}
              onMouseLeave={closeWheel}
            >
              {/* NO disk — icons float freely */}

              {/* Center "AI" hub button */}
              <button
                className={styles.hub}
                style={{ top: CY, left: CX }}
                onClick={() => setOpen(false)}
              >
                AI
              </button>

              {/* Arc nodes */}
              {active.map((tool, i) => {
                const angle = N > 1
                  ? -HALF_ARC + (i / (N - 1)) * (HALF_ARC * 2)
                  : 0;
                const nx = CX + R * Math.cos(angle);
                const ny = CY + R * Math.sin(angle);
                const isHov = hovered === tool.id;
                const isDragging = draggingId === tool.id;
                const isDragTarget = dragOver === i;

                return (
                  <motion.div
                    key={tool.id}
                    className={`${styles.nodeWrap} ${isDragging ? styles.dragging : ''} ${isDragTarget ? styles.dragTarget : ''}`}
                    style={{ left: nx, top: ny }}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ delay: i * 0.04, type: 'spring', stiffness: 380, damping: 28 }}
                    draggable
                    onDragStart={() => handleDragStart(tool.id)}
                    onDragOver={e => { e.preventDefault(); handleDragOver(i); }}
                    onDrop={() => handleDrop(i)}
                    onDragEnd={() => { setDraggingId(null); setDragOver(null); }}
                  >
                    <a
                      href={tool.url}
                      className={`${styles.node} ${isHov ? styles.nodeHovered : ''}`}
                      onClick={e => handleClick(tool, e)}
                      onMouseEnter={() => setHovered(tool.id)}
                      onMouseLeave={() => setHovered(null)}
                      title={tool.name}
                      draggable={false}
                    >
                      <span
                        className={styles.icon}
                        dangerouslySetInnerHTML={{ __html: tool.icon }}
                      />
                    </a>

                    {/* Hover tooltip */}
                    <AnimatePresence>
                      {isHov && (
                        <motion.div
                          className={styles.tooltip}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -8 }}
                          transition={{ duration: 0.1 }}
                        >
                          {tool.name}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

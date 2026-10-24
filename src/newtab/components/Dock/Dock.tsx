import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStorage } from '../../hooks/useStorage';
import { KEYS } from '../../../shared/storage';
import { DEFAULT_DOCK_ITEMS } from '../../../shared/defaults';
import type { DockItem, TabSnapshot } from '../../../shared/types';
import { extractDomain } from '../../../shared/utils';
import styles from './Dock.module.css';
import { IconRenderer } from '../IconRenderer';
import { playTactileTick } from '../../../shared/audio';

export default function Dock() {
  const [items, setItems] = useStorage<DockItem[]>(KEYS.DOCK_ITEMS, DEFAULT_DOCK_ITEMS);
  const [snapshot] = useStorage<TabSnapshot | null>(KEYS.TAB_SNAPSHOT, null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  const [editingItem, setEditingItem] = useState<DockItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', url: '' });

  // Self-healing migration to ensure TryHackMe and Telegram are present once, but can be removed afterward
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    if (items && items.length > 0) {
      chrome.storage.local.get('ex1:dock_migrated_v2', (res) => {
        if (!res['ex1:dock_migrated_v2']) {
          let changed = false;
          const updated = [...items];
          
          const hasTryHackMe = items.some(t => t.url && t.url.includes('tryhackme.com'));
          if (!hasTryHackMe) {
            const defTry = DEFAULT_DOCK_ITEMS.find(d => d.id === 'tryhackme');
            if (defTry) {
              updated.push({ ...defTry, order: updated.length });
              changed = true;
            }
          }
          
          const hasTelegram = items.some(t => t.url && (t.url.includes('telegram.org') || t.url.includes('t.me')));
          if (!hasTelegram) {
            const defTel = DEFAULT_DOCK_ITEMS.find(d => d.id === 'telegram');
            if (defTel) {
              updated.push({ ...defTel, order: updated.length });
              changed = true;
            }
          }
          
          if (changed) {
            setItems(updated);
          }
          chrome.storage.local.set({ 'ex1:dock_migrated_v2': true });
        }
      });
    }
  }, [items, setItems]);

  // Compute which items match open tabs (active domains)
  const openDomains = new Set(snapshot?.tabs.map((t) => t.domain) ?? []);

  const handleItemClick = (item: DockItem, e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: item.url });
    } else {
      window.open(item.url, '_blank');
    }
  };

  const handleContextMenu = (item: DockItem, e: React.MouseEvent) => {
    e.preventDefault();
    setEditingItem(item);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    let url = editingItem.url.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    const updatedItem = { ...editingItem, url };
    const updated = items.map((t) => (t.id === editingItem.id ? updatedItem : t));
    setItems(updated);
    setEditingItem(null);
  };

  const handleRemove = () => {
    if (!editingItem) return;
    const updated = items.filter((t) => t.id !== editingItem.id);
    setItems(updated);
    setEditingItem(null);
  };

  const handleAddItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let url = newItem.url.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    const domain = extractDomain(url);
    const item: DockItem = {
      id: `dock_${Date.now()}`,
      name: newItem.name,
      url: url,
      // Generic SVG fallback
      icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/></svg>`,
      order: items.length,
    };
    setItems([...items, item]);
    setIsAdding(false);
    setNewItem({ name: '', url: '' });
  };

  // Drag and drop sorting handlers
  const handleDragStart = (idx: number) => {
    setDraggedIndex(idx);
  };

  const handleDragOver = (idx: number) => {
    if (draggedIndex === null || draggedIndex === idx) return;
    const reordered = [...items];
    const [moved] = reordered.splice(draggedIndex, 1);
    reordered.splice(idx, 0, moved);
    // update order properties
    const updated = reordered.map((item, i) => ({ ...item, order: i }));
    setItems(updated);
    setDraggedIndex(idx);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <>
      <div className={styles.dockWrapper}>
        <div
          className={styles.dockContainer}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {items
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((item, idx) => {
              const domain = extractDomain(item.url);
              const isActive = openDomains.has(domain);

              // macOS scale computation
              let scale = 1.0;
              let glowOpacity = 0;
              if (hoverIndex !== null) {
                const diff = Math.abs(idx - hoverIndex);
                if (diff === 0) { scale = 1.4; glowOpacity = 0.35; }
                else if (diff === 1) { scale = 1.2; glowOpacity = 0.18; }
                else if (diff === 2) { scale = 1.05; glowOpacity = 0.06; }
              }

              return (
                <div
                  key={item.id}
                  className={styles.itemWrapper}
                  onMouseEnter={() => {
                    setHoverIndex(idx);
                    playTactileTick();
                  }}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    handleDragOver(idx);
                  }}
                  onDragEnd={handleDragEnd}
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'bottom center',
                    zIndex: hoverIndex === idx ? 10 : 1,
                  }}
                >
                  <a
                    href={item.url}
                    className={styles.dockItem}
                    onClick={(e) => handleItemClick(item, e)}
                    onContextMenu={(e) => handleContextMenu(item, e)}
                    title={item.name}
                    style={{
                      boxShadow: glowOpacity > 0 
                        ? `0 10px 30px color-mix(in srgb, var(--accent) ${Math.min(100, glowOpacity * 250)}%, transparent), 0 0 15px color-mix(in srgb, var(--accent) ${Math.min(100, glowOpacity * 200)}%, transparent)` 
                        : undefined,
                      borderColor: glowOpacity > 0
                        ? `color-mix(in srgb, var(--accent) ${Math.min(100, glowOpacity * 250)}%, var(--border))`
                        : undefined
                    }}
                  >
                    <IconRenderer icon={item.icon} name={item.name} url={item.url} />
                    {isActive && <div className={styles.activeDot} />}
                  </a>
                </div>
              );
            })}

          <button
            onClick={() => setIsAdding(true)}
            className={styles.addBtn}
            title="Add Shortcut"
            onMouseEnter={playTactileTick}
          >
            +
          </button>
        </div>
      </div>

      {/* Edit modal */}
      <AnimatePresence>
        {editingItem && (
          <div className={styles.modalOverlay} onClick={() => setEditingItem(null)}>
            <motion.form
              className="glass-card"
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSaveEdit}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              style={{ padding: '24px', width: '320px', display: 'flex', flexDirection: 'column', gap: '16px', zIndex: 1000 }}
            >
              <div style={{ fontSize: '14px', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Edit Shortcut
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>NAME</label>
                <input
                  type="text"
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px', color: 'var(--text-primary)' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>URL</label>
                <input
                  type="text"
                  value={editingItem.url}
                  onChange={(e) => setEditingItem({ ...editingItem, url: e.target.value })}
                  style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px', color: 'var(--text-primary)' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="submit" style={{ flex: 1, background: 'var(--accent)', color: '#000000', border: 'none', padding: '8px', borderRadius: 'var(--radius-sm)', fontWeight: 600, cursor: 'pointer' }}>
                  Save
                </button>
                <button type="button" onClick={handleRemove} style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                  Remove
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Add modal */}
      <AnimatePresence>
        {isAdding && (
          <div className={styles.modalOverlay} onClick={() => setIsAdding(false)}>
            <motion.form
              className="glass-card"
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleAddItemSubmit}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              style={{ padding: '24px', width: '320px', display: 'flex', flexDirection: 'column', gap: '16px', zIndex: 1000 }}
            >
              <div style={{ fontSize: '14px', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Add Shortcut
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>NAME</label>
                <input
                  type="text"
                  placeholder="e.g. HackerRank"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px', color: 'var(--text-primary)' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>URL</label>
                <input
                  type="text"
                  placeholder="e.g. hackerrank.com"
                  value={newItem.url}
                  onChange={(e) => setNewItem({ ...newItem, url: e.target.value })}
                  style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px', color: 'var(--text-primary)' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="submit" style={{ flex: 1, background: 'var(--accent)', color: '#000000', border: 'none', padding: '8px', borderRadius: 'var(--radius-sm)', fontWeight: 600, cursor: 'pointer' }}>
                  Add Shortcut
                </button>
                <button type="button" onClick={() => setIsAdding(false)} style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-primary)' }}>
                  Cancel
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}


import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStorage } from '../../hooks/useStorage';
import { KEYS } from '../../../shared/storage';
import { DEFAULT_SETTINGS, DEFAULT_AI_TOOLS, DEFAULT_DOCK_ITEMS } from '../../../shared/defaults';
import type { AppSettings, AITool, DockItem, ThemeId } from '../../../shared/types';
import styles from './SettingsPanel.module.css';
import { IconRenderer } from '../IconRenderer';

const THEMES: { id: ThemeId; name: string; color: string }[] = [
  { id: 'platinum',   name: 'Platinum',      color: '#E5E7EB' },
  { id: 'sapphire',   name: 'Sapphire',      color: '#1535C2' },
  { id: 'crimson',    name: 'Crimson',       color: '#C81E3A' },
  { id: 'gold',       name: 'Gold',          color: '#C9A24B' },
  { id: 'emerald',    name: 'Emerald',       color: '#166246' },
  { id: 'violet',     name: 'Violet',        color: '#7C5CFF' },
  { id: 'neon-tokyo', name: 'Neon Tokyo',    color: '#FF007F' },
  { id: 'solar-flare',name: 'Solar Flare',   color: '#FF5E00' },
  { id: 'obsidian',   name: 'Obsidian Steel',color: '#4A7FA5' },
  { id: 'rose-gold',  name: 'Rose Gold',     color: '#E8446A' },
];

export default function SettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'tools' | 'dock' | 'appearance' | 'shortcuts' | 'about'>('tools');
  const [newToolName, setNewToolName] = useState('');
  const [newToolUrl, setNewToolUrl] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useStorage<AppSettings>(KEYS.SETTINGS, DEFAULT_SETTINGS);
  const [aiTools, setAiTools] = useStorage<AITool[]>(KEYS.AI_TOOLS, DEFAULT_AI_TOOLS);
  const [dockItems, setDockItems] = useStorage<DockItem[]>(KEYS.DOCK_ITEMS, DEFAULT_DOCK_ITEMS);

  // Close settings panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Only close if we clicked outside the panel itself and outside the trigger gear button
        const target = e.target as HTMLElement;
        if (!target.closest(`.${styles.gearBtn}`)) {
          setIsOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportConfig = () => {
    const backup = {
      settings,
      aiTools,
      dockItems,
      version: '2.0.0',
      exportedAt: Date.now(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ex1_config_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.settings) setSettings(data.settings);
        if (data.aiTools) setAiTools(data.aiTools);
        if (data.dockItems) setDockItems(data.dockItems);
        alert('Configuration imported successfully!');
      } catch (err) {
        alert('Failed to parse backup file. Invalid format.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className={styles.wrapper}>
      {/* Settings Trigger Gear Button */}
      <button onClick={() => setIsOpen(!isOpen)} className={styles.gearBtn} title="HUD Settings">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
        </svg>
      </button>

      {/* Slide-up-left Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            className={`${styles.panel} glass-card`}
            initial={{ scale: 0.95, opacity: 0, y: 20, x: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0, x: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20, x: 20 }}
            transition={{ type: 'spring', stiffness: 250, damping: 26 }}
          >
            {/* Header strip with Close button */}
            <div className={styles.panelHeader}>
              <div className={styles.headerTitle}>
                <span className={styles.gearIcon}>⚙</span>
                eX1 HUD SETTINGS
              </div>
              <button onClick={() => setIsOpen(false)} className={styles.closeBtn}>
                (×)
              </button>
            </div>

            <div className={styles.panelBody}>
              {/* Sidebar Tab Rail */}
              <div className={styles.sidebar}>
                <button
                  onClick={() => setActiveTab('tools')}
                  className={`${styles.tabBtn} ${activeTab === 'tools' ? styles.activeTab : ''}`}
                >
                  AI Dock
                </button>
                <button
                  onClick={() => setActiveTab('dock')}
                  className={`${styles.tabBtn} ${activeTab === 'dock' ? styles.activeTab : ''}`}
                >
                  Dock
                </button>
                <button
                  onClick={() => setActiveTab('appearance')}
                  className={`${styles.tabBtn} ${activeTab === 'appearance' ? styles.activeTab : ''}`}
                >
                  Appearance
                </button>
                <button
                  onClick={() => setActiveTab('shortcuts')}
                  className={`${styles.tabBtn} ${activeTab === 'shortcuts' ? styles.activeTab : ''}`}
                >
                  Shortcuts
                </button>
                <button
                  onClick={() => setActiveTab('about')}
                  className={`${styles.tabBtn} ${activeTab === 'about' ? styles.activeTab : ''}`}
                >
                  About
                </button>
              </div>

              {/* Content Panel Area */}
              <div className={styles.content}>
                {activeTab === 'tools' && (
                  <div className={styles.tabContent}>
                    <div className={styles.sectionTitle}>AI DOCK CONFIGURATION</div>
                    <div className={styles.scrollList}>
                      {aiTools.map((tool, idx) => (
                        <div key={tool.id} className={styles.editorRow}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                            <IconRenderer icon={tool.icon} name={tool.name} url={tool.url} size={20} />
                            <span className={styles.editorName}>{tool.name}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...aiTools];
                                if (idx > 0) { [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]]; }
                                setAiTools(updated.map((t, i) => ({ ...t, order: i })));
                              }}
                              className={styles.toggleBtn}
                              style={{ padding: '2px 8px', fontSize: '10px' }}
                              disabled={idx === 0}
                            >↑</button>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...aiTools];
                                if (idx < updated.length - 1) { [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]]; }
                                setAiTools(updated.map((t, i) => ({ ...t, order: i })));
                              }}
                              className={styles.toggleBtn}
                              style={{ padding: '2px 8px', fontSize: '10px' }}
                              disabled={idx === aiTools.length - 1}
                            >↓</button>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = aiTools.map(t =>
                                  t.id === tool.id ? { ...t, pinned: !t.pinned } : t
                                );
                                setAiTools(updated);
                              }}
                              className={`${styles.toggleBtn} ${tool.pinned ? styles.toggleActive : ''}`}
                            >
                              {tool.pinned ? 'ON' : 'OFF'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setAiTools(aiTools.filter(t => t.id !== tool.id))}
                              className={styles.deleteBtn}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add new AI tool */}
                    <div className={styles.dropdownDivider} style={{ margin: '14px 0 10px' }} />
                    <div className={styles.sectionTitle}>ADD NEW TOOL</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <input
                        type="text"
                        placeholder="Tool name (e.g. Mistral)"
                        value={newToolName}
                        onChange={e => setNewToolName(e.target.value)}
                        className={styles.textInput}
                      />
                      <input
                        type="url"
                        placeholder="URL (e.g. https://mistral.ai)"
                        value={newToolUrl}
                        onChange={e => setNewToolUrl(e.target.value)}
                        className={styles.textInput}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newToolName.trim() || !newToolUrl.trim()) return;
                          let url = newToolUrl.trim();
                          if (!/^https?:\/\//i.test(url)) {
                            url = 'https://' + url;
                          }
                          const domain = url.replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./i, '');
                          const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
                          const newTool: AITool = {
                            id: `custom_${Date.now()}`,
                            name: newToolName.trim(),
                            url: url,
                            icon: faviconUrl,
                            pinned: true,
                            order: aiTools.length,
                          };
                          setAiTools([...aiTools, newTool]);
                          setNewToolName('');
                          setNewToolUrl('');
                        }}
                        className={styles.exportBtn}
                        style={{ marginTop: '4px' }}
                      >
                        + ADD TO DOCK
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'dock' && (
                  <div className={styles.tabContent}>
                    <div className={styles.sectionTitle}>BOTTOM DOCK CONFIGURATION</div>
                    <div className={styles.scrollList}>
                      {dockItems.map((item) => (
                        <div key={item.id} className={styles.editorRow}>
                          <span className={styles.editorName}>{item.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = dockItems.filter((d) => d.id !== item.id);
                              setDockItems(updated);
                            }}
                            className={styles.deleteBtn}
                          >
                            REMOVE
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'appearance' && (
                  <div className={styles.tabContent}>
                    <div className={styles.sectionTitle}>THEME SELECTOR</div>
                    <div className={styles.themeGrid}>
                      {THEMES.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setSettings({ ...settings, theme: t.id })}
                          className={`${styles.themeBtn} ${settings.theme === t.id ? styles.themeActive : ''}`}
                        >
                          <div className={styles.themeColorSwatch} style={{ background: t.color }} />
                          <span>{t.name}</span>
                        </button>
                      ))}
                    </div>

                    <div className={styles.fieldRow}>
                      <label className={styles.fieldLabel}>CLOCK DISPLAY STYLE</label>
                      <select
                        value={settings.clockStyle}
                        onChange={(e) => setSettings({ ...settings, clockStyle: e.target.value as never })}
                        className={styles.select}
                      >
                        <option value="digital">Digital (monospace)</option>
                        <option value="analog">Analog (vector hands)</option>
                      </select>
                    </div>

                    <div className={styles.fieldRow}>
                      <label className={styles.fieldLabel}>TIME CONVENTION</label>
                      <select
                        value={settings.clockMode}
                        onChange={(e) => setSettings({ ...settings, clockMode: e.target.value as never })}
                        className={styles.select}
                      >
                        <option value="24h">24-hour (military)</option>
                        <option value="12h">12-hour (AM/PM)</option>
                      </select>
                    </div>

                    <div className={styles.fieldRow}>
                      <label className={styles.fieldLabel}>GLASS BLUR EFFECT ({settings.blurAmount}px)</label>
                      <input
                        type="range"
                        min="0"
                        max="40"
                        value={settings.blurAmount}
                        onChange={(e) => setSettings({ ...settings, blurAmount: parseInt(e.target.value) })}
                        className={styles.slider}
                      />
                    </div>

                    <div className={styles.fieldRow}>
                      <label className={styles.fieldLabel}>ANIMATION SPEED</label>
                      <select
                        value={settings.animationSpeed || 'normal'}
                        onChange={(e) => setSettings({ ...settings, animationSpeed: e.target.value as never })}
                        className={styles.select}
                      >
                        <option value="fast">Fast (0.09s)</option>
                        <option value="normal">Normal (0.15s)</option>
                        <option value="slow">Slow (0.28s)</option>
                      </select>
                    </div>
                  </div>
                )}

                {activeTab === 'shortcuts' && (
                  <div className={styles.tabContent}>
                    <div className={styles.sectionTitle}>INTERACTION SHORTCUTS</div>

                    <div className={styles.editorRow}>
                      <div>
                        <div className={styles.settingHeader}>LEFT EDGE ACTIVATE</div>
                        <div className={styles.settingDesc}>Hover the screen's left edge to open the AI Dock.</div>
                      </div>
                      <button
                        onClick={() => setSettings({ ...settings, edgeActivation: !settings.edgeActivation })}
                        className={`${styles.toggleBtn} ${settings.edgeActivation ? styles.toggleActive : ''}`}
                      >
                        {settings.edgeActivation ? 'ENABLED' : 'DISABLED'}
                      </button>
                    </div>

                    <div className={styles.fieldRow}>
                      <label className={styles.fieldLabel}>AI DOCK SHORTCUT</label>
                      <input
                        type="text"
                        value={settings.shortcut || 'Alt+Space'}
                        disabled
                        className={styles.textInput}
                        style={{ opacity: 0.5, cursor: 'not-allowed' }}
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'about' && (
                  <div className={styles.tabContent}>
                    <div className={styles.sectionTitle}>SYSTEM BACKUP</div>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                      Export all custom shortcuts, settings, blocklists, and configurations to a single JSON archive.
                    </p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={handleExportConfig} className={styles.exportBtn}>
                        EXPORT CONFIGURATION
                      </button>
                      <label className={styles.importLabel}>
                        IMPORT CONFIGURATION
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleImportConfig}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>

                    <div className={styles.dropdownDivider} style={{ margin: '20px 0' }} />

                    <div className={styles.sectionTitle}>eX1 FIRMWARE DETAILS</div>
                    <div className={`${styles.aboutMeta} mono`}>
                      <div>SYSTEM: eX1 Companion</div>
                      <div>CORE: Manifest V3 Architecture</div>
                      <div>VERSION: 2.0.0 (Instrument Grade)</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

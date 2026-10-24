import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStorage } from '../../hooks/useStorage';
import { KEYS } from '../../../shared/storage';
import { DEFAULT_SETTINGS, DEFAULT_AI_TOOLS, DEFAULT_DOCK_ITEMS } from '../../../shared/defaults';
import type { AppSettings, AITool, DockItem, ThemeId } from '../../../shared/types';
import styles from './SettingsPanel.module.css';
import { IconRenderer } from '../IconRenderer';
import { hashPin } from '../../../face/pin';

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
  const [activeTab, setActiveTab] = useState<'tools' | 'dock' | 'appearance' | 'shortcuts' | 'privacy' | 'about'>('tools');
  const [newToolName, setNewToolName] = useState('');
  const [newToolUrl, setNewToolUrl] = useState('');
  const [newPrivateDomain, setNewPrivateDomain] = useState('');
  const [masterPwInput, setMasterPwInput] = useState('');
  const [pwUpdateStatus, setPwUpdateStatus] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useStorage<AppSettings>(KEYS.SETTINGS, DEFAULT_SETTINGS);
  const [aiTools, setAiTools] = useStorage<AITool[]>(KEYS.AI_TOOLS, DEFAULT_AI_TOOLS);
  const [dockItems, setDockItems] = useStorage<DockItem[]>(KEYS.DOCK_ITEMS, DEFAULT_DOCK_ITEMS);
  const [privateSites, setPrivateSites] = useStorage<string[]>(KEYS.PRIVATE_SITES, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest(`.${styles.gearBtn}`)) setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updatePrivateSitesList = (sites: string[]) => {
    setPrivateSites(sites);
    chrome.storage.local.set({ 'facelock:privateSites': sites });
    chrome.storage.local.get('settings', (res: any) => {
      const s = res?.settings || {};
      chrome.storage.local.set({ settings: { ...s, faceLock: { ...(s.faceLock || {}), gatedSites: sites } } });
    });
  };

  const handleUpdateMasterPassword = async () => {
    if (!masterPwInput || masterPwInput.trim().length < 4) {
      setPwUpdateStatus('Password must be at least 4 characters');
      return;
    }
    try {
      const { pinHash, pinSalt } = await hashPin(masterPwInput.trim());
      const res: any = await chrome.storage.local.get('settings');
      const s = res?.settings || {};
      const updated = { ...s, faceLock: { ...(s.faceLock || {}), enabled: true, pinHash, pinSalt } };
      await chrome.storage.local.set({ settings: updated, 'facelock:pin': { pinHash, pinSalt } });
      setMasterPwInput('');
      setPwUpdateStatus('✓ Master password updated');
      setTimeout(() => setPwUpdateStatus(''), 2500);
    } catch (e: any) {
      setPwUpdateStatus('Error: ' + (e?.message || e));
    }
  };

  const handleExportConfig = () => {
    const backup = { settings, aiTools, dockItems, version: '2.0.0', exportedAt: Date.now() };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ex_config_backup_${Date.now()}.json`;
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
      } catch { alert('Failed to parse backup file.'); }
    };
    reader.readAsText(file);
  };

  return (
    <div className={styles.wrapper}>
      <button onClick={() => setIsOpen(!isOpen)} className={styles.gearBtn} title="HUD Settings">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
        </svg>
      </button>

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
            <div className={styles.panelHeader}>
              <div className={styles.headerTitle}><span className={styles.gearIcon}>⚙</span> eX SETTINGS</div>
              <button onClick={() => setIsOpen(false)} className={styles.closeBtn}>(×)</button>
            </div>

            <div className={styles.panelBody}>
              <div className={styles.sidebar}>
                {(['tools', 'dock', 'appearance', 'shortcuts', 'privacy', 'about'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`${styles.tabBtn} ${activeTab === tab ? styles.activeTab : ''}`}
                  >
                    {tab === 'tools' ? 'AI Dock' : tab === 'dock' ? 'Dock' : tab === 'appearance' ? 'Appearance' : tab === 'shortcuts' ? 'Shortcuts' : tab === 'privacy' ? '🔒 Face Lock' : 'About'}
                  </button>
                ))}
              </div>

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
                            <button type="button" onClick={() => {
                              const updated = [...aiTools];
                              if (idx > 0) { [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]]; }
                              setAiTools(updated.map((t, i) => ({ ...t, order: i })));
                            }} className={styles.toggleBtn} disabled={idx === 0}>↑</button>
                            <button type="button" onClick={() => {
                              const updated = [...aiTools];
                              if (idx < updated.length - 1) { [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]]; }
                              setAiTools(updated.map((t, i) => ({ ...t, order: i })));
                            }} className={styles.toggleBtn} disabled={idx === aiTools.length - 1}>↓</button>
                            <button type="button" onClick={() => setAiTools(aiTools.map(t => t.id === tool.id ? { ...t, pinned: !t.pinned } : t))} className={`${styles.toggleBtn} ${tool.pinned ? styles.toggleActive : ''}`}>
                              {tool.pinned ? 'ON' : 'OFF'}
                            </button>
                            <button type="button" onClick={() => setAiTools(aiTools.filter(t => t.id !== tool.id))} className={styles.deleteBtn}>✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className={styles.dropdownDivider} style={{ margin: '14px 0 10px' }} />
                    <div className={styles.sectionTitle}>ADD NEW TOOL</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <input type="text" placeholder="Tool name (e.g. Mistral)" value={newToolName} onChange={e => setNewToolName(e.target.value)} className={styles.textInput} />
                      <input type="url" placeholder="URL (e.g. https://mistral.ai)" value={newToolUrl} onChange={e => setNewToolUrl(e.target.value)} className={styles.textInput} />
                      <button type="button" onClick={() => {
                        if (!newToolName.trim() || !newToolUrl.trim()) return;
                        let url = newToolUrl.trim();
                        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
                        const domain = url.replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./i, '');
                        setAiTools([...aiTools, { id: `custom_${Date.now()}`, name: newToolName.trim(), url, icon: `https://www.google.com/s2/favicons?sz=64&domain=${domain}`, pinned: true, order: aiTools.length }]);
                        setNewToolName(''); setNewToolUrl('');
                      }} className={styles.exportBtn} style={{ marginTop: '4px' }}>+ ADD TO DOCK</button>
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
                          <button type="button" onClick={() => setDockItems(dockItems.filter(d => d.id !== item.id))} className={styles.deleteBtn}>REMOVE</button>
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
                        <button key={t.id} onClick={() => setSettings({ ...settings, theme: t.id })} className={`${styles.themeBtn} ${settings.theme === t.id ? styles.themeActive : ''}`}>
                          <div className={styles.themeColorSwatch} style={{ background: t.color }} />
                          <span>{t.name}</span>
                        </button>
                      ))}
                    </div>
                    <div className={styles.fieldRow}>
                      <label className={styles.fieldLabel}>CLOCK DISPLAY STYLE</label>
                      <select value={settings.clockStyle} onChange={e => setSettings({ ...settings, clockStyle: e.target.value as never })} className={styles.select}>
                        <option value="digital">Digital (monospace)</option>
                        <option value="analog">Analog (vector hands)</option>
                      </select>
                    </div>
                    <div className={styles.fieldRow}>
                      <label className={styles.fieldLabel}>TIME CONVENTION</label>
                      <select value={settings.clockMode} onChange={e => setSettings({ ...settings, clockMode: e.target.value as never })} className={styles.select}>
                        <option value="24h">24-hour (military)</option>
                        <option value="12h">12-hour (AM/PM)</option>
                      </select>
                    </div>
                    <div className={styles.fieldRow}>
                      <label className={styles.fieldLabel}>GLASS BLUR EFFECT ({settings.blurAmount}px)</label>
                      <input type="range" min="0" max="40" value={settings.blurAmount} onChange={e => setSettings({ ...settings, blurAmount: parseInt(e.target.value) })} className={styles.slider} />
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
                      <button onClick={() => setSettings({ ...settings, edgeActivation: !settings.edgeActivation })} className={`${styles.toggleBtn} ${settings.edgeActivation ? styles.toggleActive : ''}`}>
                        {settings.edgeActivation ? 'ENABLED' : 'DISABLED'}
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'privacy' && (
                  <div className={styles.tabContent}>
                    <div className={styles.sectionTitle}>FACE LOCK & PRIVATE SITES</div>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: '1.5' }}>
                      Sites listed here require face recognition or master password verification before they can be accessed.
                    </p>

                    {/* Matching Threshold Slider */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                        <span style={{ color: '#fff', fontWeight: 600 }}>FACE MATCHING THRESHOLD</span>
                        <span style={{ color: '#00ffd2', fontWeight: 700 }}>{((settings.faceLock?.threshold ?? 0.50)).toFixed(2)}</span>
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                        Lower = faster / lenient; Higher = stricter biometric matching.
                      </div>
                      <input
                        type="range"
                        min="0.30"
                        max="0.75"
                        step="0.05"
                        value={settings.faceLock?.threshold ?? 0.50}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setSettings({ ...settings, faceLock: { ...(settings.faceLock || {}), threshold: val } });
                          chrome.storage.local.get('settings', (res: any) => {
                            const s = res?.settings || {};
                            chrome.storage.local.set({ settings: { ...s, faceLock: { ...(s.faceLock || {}), threshold: val } } });
                          });
                        }}
                        className={styles.slider}
                        style={{ marginTop: '4px' }}
                      />
                    </div>

                    {/* Master Fallback Password */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                      <div style={{ fontSize: '11px', color: '#fff', fontWeight: 600 }}>MASTER FALLBACK PASSWORD</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                        Set or change the master password used when camera is unavailable.
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        <input
                          type="password"
                          placeholder="New password (4+ chars)..."
                          value={masterPwInput}
                          onChange={e => setMasterPwInput(e.target.value)}
                          className={styles.textInput}
                          style={{ flex: 1 }}
                        />
                        <button type="button" onClick={handleUpdateMasterPassword} className={styles.exportBtn}>
                          UPDATE
                        </button>
                      </div>
                      {pwUpdateStatus && (
                        <span style={{ fontSize: '10px', color: pwUpdateStatus.startsWith('✓') ? '#00ffd2' : '#ff453a', fontWeight: 600 }}>
                          {pwUpdateStatus}
                        </span>
                      )}
                    </div>

                    {/* Gated Sites List */}
                    <div className={styles.dropdownDivider} style={{ margin: '14px 0 10px' }} />
                    <div className={styles.sectionTitle}>GATED DOMAINS</div>
                    <div className={styles.scrollList} style={{ maxHeight: '120px' }}>
                      {(!privateSites || privateSites.length === 0) && (
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '6px 0', textAlign: 'center' }}>
                          No private sites configured.
                        </div>
                      )}
                      {(privateSites || []).map((domain) => (
                        <div key={domain} className={styles.editorRow}>
                          <span className={styles.editorName} style={{ fontFamily: 'monospace', fontSize: '12px' }}>{domain}</span>
                          <button type="button" onClick={() => updatePrivateSitesList((privateSites || []).filter(d => d !== domain))} className={styles.deleteBtn}>
                            REMOVE
                          </button>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                      <input
                        id="ex-settings-private-site-input"
                        type="text"
                        placeholder="e.g. mail.google.com"
                        value={newPrivateDomain}
                        onChange={e => setNewPrivateDomain(e.target.value.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0])}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            const d = newPrivateDomain.trim();
                            if (!d || (privateSites || []).includes(d)) return;
                            updatePrivateSitesList([...(privateSites || []), d]);
                            setNewPrivateDomain('');
                          }
                        }}
                        className={styles.textInput}
                      />
                      <button
                        id="ex-settings-private-site-add-btn"
                        type="button"
                        onClick={() => {
                          const d = newPrivateDomain.trim();
                          if (!d || (privateSites || []).includes(d)) return;
                          updatePrivateSitesList([...(privateSites || []), d]);
                          setNewPrivateDomain('');
                        }}
                        className={styles.exportBtn}
                      >
                        + ADD GATED SITE
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'about' && (
                  <div className={styles.tabContent}>
                    <div className={styles.sectionTitle}>SYSTEM BACKUP</div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={handleExportConfig} className={styles.exportBtn}>EXPORT CONFIG</button>
                      <label className={styles.importLabel}>
                        IMPORT CONFIG
                        <input type="file" accept=".json" onChange={handleImportConfig} style={{ display: 'none' }} />
                      </label>
                    </div>
                    <div className={styles.dropdownDivider} style={{ margin: '14px 0' }} />
                    <div className={styles.sectionTitle}>eX SYSTEM DETAILS</div>
                    <div className={`${styles.aboutMeta} mono`}>
                      <div>SYSTEM: eX</div>
                      <div>CORE: Manifest V3 Architecture</div>
                      <div>SECURITY: Neural FaceNet + PBKDF2</div>
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

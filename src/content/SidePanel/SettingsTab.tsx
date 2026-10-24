import React, { useState, useEffect } from 'react';

interface SettingsTabProps {
  onClearData: () => void;
}

export default function SettingsTab({ onClearData }: SettingsTabProps) {
  const [settings, setSettings] = useState<any>({
    cloudEnabled: true,
    scanSites: true,
    scanGmail: true,
    faceLock: {
      enabled: false,
      gatedSites: [],
      threshold: 0.5,
    },
    apiKeys: { KEY_1: '', KEY_2: '', KEY_3: '' },
  });
  const [newGatedSite, setNewGatedSite] = useState('');
  const [showAiPreview, setShowAiPreview] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (res) => {
      if (res?.ok && res.data) {
        setSettings(res.data);
      }
    });
  }, []);

  const savePatch = (patch: any) => {
    chrome.runtime.sendMessage({ type: 'PATCH_SETTINGS', patch }, (res) => {
      if (res?.ok && res.data) {
        setSettings(res.data);
        setSavedMsg('Settings saved');
        setTimeout(() => setSavedMsg(''), 2000);
      }
    });
  };

  const handleAddSite = () => {
    if (!newGatedSite.trim()) return;
    const clean = newGatedSite.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const currentList: string[] = settings.faceLock?.gatedSites || [];
    if (!currentList.includes(clean)) {
      const updated = [...currentList, clean];
      savePatch({ faceLock: { ...settings.faceLock, gatedSites: updated } });
    }
    setNewGatedSite('');
  };

  const handleRemoveSite = (site: string) => {
    const currentList: string[] = settings.faceLock?.gatedSites || [];
    const updated = currentList.filter((s) => s !== site);
    savePatch({ faceLock: { ...settings.faceLock, gatedSites: updated } });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '16px', overflowY: 'auto', flex: 1 }}>
      {savedMsg && (
        <div style={{ padding: '8px 12px', background: 'rgba(0,255,210,0.1)', border: '1px solid #00ffd2', borderRadius: '6px', color: '#00ffd2', fontSize: '11px', textAlign: 'center' }}>
          ✓ {savedMsg}
        </div>
      )}

      {/* Security Engine Toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted, #888)' }}>
          Security Engine Toggles
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border, rgba(255,255,255,0.08))', borderRadius: '8px', padding: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '12px', color: '#fff' }}>
            <span>Cloud AI Reasoning Engine</span>
            <input
              type="checkbox"
              checked={settings.cloudEnabled !== false}
              onChange={(e) => savePatch({ cloudEnabled: e.target.checked })}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '12px', color: '#fff' }}>
            <span>Scan Websites Automatically</span>
            <input
              type="checkbox"
              checked={settings.scanSites !== false}
              onChange={(e) => savePatch({ scanSites: e.target.checked })}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '12px', color: '#fff' }}>
            <span>Scan Gmail Inbox Automatically</span>
            <input
              type="checkbox"
              checked={settings.scanGmail !== false}
              onChange={(e) => savePatch({ scanGmail: e.target.checked })}
            />
          </label>
        </div>
      </div>

      {/* Face Lock Settings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted, #888)' }}>
          Identity & Face Lock
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border, rgba(255,255,255,0.08))', borderRadius: '8px', padding: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '12px', color: '#fff' }}>
            <span>Enable Face Lock on Gated Sites</span>
            <input
              type="checkbox"
              checked={!!settings.faceLock?.enabled}
              onChange={(e) => savePatch({ faceLock: { ...settings.faceLock, enabled: e.target.checked } })}
            />
          </label>

          {/* Gated Sites List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary, #aaa)' }}>Gated Hostnames:</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                placeholder="e.g. mail.google.com"
                value={newGatedSite}
                onChange={(e) => setNewGatedSite(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSite()}
                style={{
                  flex: 1, padding: '6px 10px', background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--panel-border, rgba(255,255,255,0.12))', borderRadius: '4px',
                  color: '#fff', fontSize: '11px',
                }}
              />
              <button
                onClick={handleAddSite}
                style={{
                  padding: '6px 10px', background: 'rgba(36,82,255,0.2)',
                  border: '1px solid rgba(36,82,255,0.5)', borderRadius: '4px',
                  color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Add
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
              {(settings.faceLock?.gatedSites || []).map((site: string) => (
                <span
                  key={site}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '3px 8px', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px',
                    fontSize: '11px', color: '#fff',
                  }}
                >
                  {site}
                  <span
                    onClick={() => handleRemoveSite(site)}
                    style={{ cursor: 'pointer', color: '#ff3b30', fontWeight: 800, marginLeft: '2px' }}
                  >
                    ×
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* Sensitivity Slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
              <span style={{ color: 'var(--text-secondary, #aaa)' }}>Matching Threshold</span>
              <span style={{ color: '#00ffd2', fontWeight: 600 }}>{settings.faceLock?.threshold ?? 0.5}</span>
            </div>
            <input
              type="range"
              min="0.3"
              max="0.7"
              step="0.05"
              value={settings.faceLock?.threshold ?? 0.5}
              onChange={(e) => savePatch({ faceLock: { ...settings.faceLock, threshold: parseFloat(e.target.value) } })}
            />
          </div>
        </div>
      </div>

      {/* AI Transparency & API Keys */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted, #888)' }}>
          API Keys & Privacy
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border, rgba(255,255,255,0.08))', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted, #888)' }}>
            NVIDIA NIM keys are built-in for zero-config operation. You can optionally override them below:
          </div>
          <input
            type="password"
            placeholder="Override KEY_1 (Chat & Mail Deep)..."
            value={settings.apiKeys?.KEY_1 || ''}
            onChange={(e) => savePatch({ apiKeys: { ...settings.apiKeys, KEY_1: e.target.value } })}
            style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '11px' }}
          />

          <button
            onClick={() => setShowAiPreview(!showAiPreview)}
            style={{
              padding: '8px 12px', background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--panel-border, rgba(255,255,255,0.1))', borderRadius: '6px',
              color: 'var(--text-primary, #fff)', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <span>👁️ What is sent to AI? (PII Redaction Preview)</span>
            <span>{showAiPreview ? '▲' : '▼'}</span>
          </button>

          {showAiPreview && (
            <div style={{
              padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '6px', fontSize: '11px', color: 'var(--text-secondary, #ccc)', display: 'flex', flexDirection: 'column', gap: '6px',
            }}>
              <span style={{ fontWeight: 600, color: '#00ffd2' }}>Automatic Client-Side Redactions:</span>
              <span>• Email addresses → <code style={{ color: '#00ffd2' }}>[EMAIL]@domain.com</code></span>
              <span>• Credit cards & digits → <code style={{ color: '#00ffd2' }}>[CARD]</code></span>
              <span>• Phone numbers & 2FA codes → <code style={{ color: '#00ffd2' }}>[PHONE] / [CODE]</code></span>
              <span>• URL query parameters → <code style={{ color: '#00ffd2' }}>?[QUERY]</code></span>
            </div>
          )}
        </div>
      </div>

      {/* Clear Data Button */}
      <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
        <button
          onClick={onClearData}
          style={{
            width: '100%', padding: '10px', background: 'rgba(255,59,48,0.1)',
            border: '1px solid rgba(255,59,48,0.35)', borderRadius: '6px',
            color: '#ff3b30', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          🗑️ Clear Cache, History & Verdicts
        </button>
      </div>
    </div>
  );
}

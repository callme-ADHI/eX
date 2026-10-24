import React from 'react';

export type TabId = 'overview' | 'site' | 'mail' | 'findings' | 'chat' | 'settings';

interface TabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onClose: () => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'site', label: 'Site' },
  { id: 'mail', label: 'Mail' },
  { id: 'findings', label: 'Findings' },
  { id: 'chat', label: 'Chat' },
  { id: 'settings', label: 'Settings' },
];

export default function Tabs({ activeTab, onTabChange, onClose }: TabsProps) {
  const tabStyle = (id: TabId): React.CSSProperties => ({
    padding: '7px 11px',
    background: activeTab === id ? 'var(--tab-active-bg, rgba(36,82,255,0.18))' : 'transparent',
    border: 'none',
    borderBottom: activeTab === id ? '2px solid var(--accent, #2452ff)' : '2px solid transparent',
    color: activeTab === id ? 'var(--text-primary, #e8e8f0)' : 'var(--text-muted, rgba(232,232,240,0.5))',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
    fontFamily: 'inherit',
    flexShrink: 0,
  });

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      borderBottom: '1px solid var(--panel-border, rgba(255,255,255,0.08))',
      flexShrink: 0,
      minHeight: '38px',
      background: 'rgba(12, 12, 18, 0.4)',
      overflowX: 'auto',
      scrollbarWidth: 'none',
    }}>
      <div style={{ display: 'flex', flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            style={tabStyle(t.id)}
            onClick={() => onTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 0, width: '1px', height: '20px', background: 'var(--panel-border, rgba(255,255,255,0.1))', margin: '0 4px' }} />
      <button
        onClick={onClose}
        aria-label="Close panel"
        style={{
          width: '34px',
          height: '34px',
          flexShrink: 0,
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted, rgba(232,232,240,0.5))',
          fontSize: '18px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'inherit',
          transition: 'color 0.15s',
        }}
        onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary, #e8e8f0)'; }}
        onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted, rgba(232,232,240,0.5))'; }}
      >
        ×
      </button>
    </div>
  );
}

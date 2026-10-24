/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  eX — Site Access & Permissions Monitor (5 Core Capabilities)
 *  src/content/SidePanel/PermissionMonitor.tsx
 *
 *  Displays exactly 5 professional rows:
 *    1. Camera (Webcam)
 *    2. Microphone
 *    3. Location (GPS)
 *    4. Notifications
 *    5. Automatic Downloads
 *
 *  Layout per row:
 *    [Icon] [Name + status text] [State Chip: Allowed | Blocked | Ask]
 *    [Activity: In use / Idle] [Segmented Control: Allow | Block]
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState } from 'react';

export interface PermissionStateMap {
  camera?: string;
  microphone?: string;
  geolocation?: string;
  notifications?: string;
  downloads?: string;
  [key: string]: string | undefined;
}

export interface PermissionMonitorProps {
  permissions: PermissionStateMap;
  cameraActive?: boolean;
  micActive?: boolean;
  exCameraActive?: boolean;
  hostname?: string;
  onRefresh?: () => void;
  onSetPermission?: (capability: string, setting: 'allow' | 'block' | 'ask') => void;
}

interface CapabilityRow {
  id: string;
  name: string;
  icon: string;
  description: string;
  stateKey: string;
  activeNow?: boolean;
  lastUsedText?: string;
}

export default function PermissionMonitor({
  permissions,
  cameraActive = false,
  micActive = false,
  exCameraActive = false,
  hostname = '',
  onRefresh,
  onSetPermission,
}: PermissionMonitorProps) {
  const [confirmAllowCap, setConfirmAllowCap] = useState<string | null>(null);

  const rows: CapabilityRow[] = [
    {
      id: 'camera',
      name: 'Camera',
      icon: '📷',
      description: 'Webcam video input capture',
      stateKey: 'camera',
      activeNow: cameraActive,
    },
    {
      id: 'microphone',
      name: 'Microphone',
      icon: '🎙️',
      description: 'Audio input and speech recording',
      stateKey: 'microphone',
      activeNow: micActive,
    },
    {
      id: 'location',
      name: 'Location',
      icon: '📍',
      description: 'Precise GPS geolocation coordinates',
      stateKey: 'geolocation',
      activeNow: false,
    },
    {
      id: 'notifications',
      name: 'Notifications',
      icon: '🔔',
      description: 'System push notifications & banners',
      stateKey: 'notifications',
      activeNow: false,
    },
    {
      id: 'downloads',
      name: 'Downloads',
      icon: '📥',
      description: 'Automatic multiple file downloads',
      stateKey: 'downloads',
      activeNow: false,
    },
  ];

  const handleToggle = (id: string, targetSetting: 'allow' | 'block') => {
    if (targetSetting === 'allow') {
      setConfirmAllowCap(id);
    } else {
      if (onSetPermission) onSetPermission(id, 'block');
    }
  };

  const confirmAllow = () => {
    if (confirmAllowCap && onSetPermission) {
      onSetPermission(confirmAllowCap, 'allow');
    }
    setConfirmAllowCap(null);
  };

  const getIconSvg = (id: string) => {
    switch (id) {
      case 'camera':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        );
      case 'microphone':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        );
      case 'location':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        );
      case 'notifications':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        );
      case 'downloads':
      default:
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8b949e' }}>
          SITE CAPABILITY PERMISSIONS
        </span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#58a6ff',
              fontSize: '10px',
              cursor: 'pointer',
              padding: '2px 4px',
            }}
          >
            Refresh
          </button>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmAllowCap && (
        <div style={{
          padding: '10px 12px',
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          fontSize: '11px',
          color: '#f0f6fc',
        }}>
          <span>Grant persistent <strong>ALLOW</strong> permission for {confirmAllowCap} on {hostname || 'this site'}?</span>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              onClick={() => setConfirmAllowCap(null)}
              style={{ background: 'transparent', border: '1px solid #30363d', color: '#c9d1d9', padding: '3px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}
            >
              Cancel
            </button>
            <button
              onClick={confirmAllow}
              style={{ background: '#238636', border: '1px solid #2ea043', color: '#ffffff', padding: '3px 10px', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', fontSize: '10px' }}
            >
              Confirm
            </button>
          </div>
        </div>
      )}
      {/* 5 Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {rows.map((row) => {
          const rawState = permissions[row.stateKey] || 'ask';
          const isAllowed = rawState === 'granted' || rawState === 'allow';
          const isBlocked = rawState === 'denied' || rawState === 'block';

          return (
            <div
              key={row.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: '42px',
                padding: '7px 12px',
                background: row.activeNow ? 'rgba(239, 68, 68, 0.06)' : '#0d1117',
                border: row.activeNow ? '1px solid #7f1d1d' : '1px solid #21262d',
                borderRadius: '6px',
              }}
            >
              {/* Left Column: Icon + Name & Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <span style={{ color: row.activeNow ? '#f87171' : '#8b949e', display: 'flex', alignItems: 'center' }}>
                  {getIconSvg(row.id)}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#f0f6fc' }}>{row.name}</span>
                    {row.activeNow ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '9.5px',
                        fontWeight: 600,
                        color: '#f87171',
                      }}>
                        <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#ef4444' }} />
                        Active Stream
                      </span>
                    ) : (
                      <span style={{ fontSize: '9.5px', color: '#6e7681' }}>Idle</span>
                    )}
                  </div>
                  <span style={{ fontSize: '9.5px', color: '#8b949e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.description}
                  </span>
                </div>
              </div>

              {/* Right Column: State Chip + Segmented Control */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* State Chip */}
                <span style={{
                  fontSize: '9.5px',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: '3px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  background: isAllowed ? 'rgba(56, 189, 248, 0.1)' : isBlocked ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                  color: isAllowed ? '#38bdf8' : isBlocked ? '#f87171' : '#8b949e',
                  border: isAllowed ? '1px solid #38bdf840' : isBlocked ? '1px solid #ef444440' : '1px solid #30363d',
                }}>
                  {isAllowed ? 'Allowed' : isBlocked ? 'Blocked' : 'Prompt'}
                </span>

                {/* Segmented Control: Allow | Block */}
                <div style={{
                  display: 'flex',
                  background: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}>
                  <button
                    type="button"
                    onClick={() => handleToggle(row.id, 'allow')}
                    aria-pressed={isAllowed}
                    style={{
                      padding: '3px 8px',
                      fontSize: '9.5px',
                      fontWeight: 600,
                      background: isAllowed ? '#238636' : 'transparent',
                      color: isAllowed ? '#ffffff' : '#8b949e',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Allow
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggle(row.id, 'block')}
                    aria-pressed={isBlocked}
                    style={{
                      padding: '3px 8px',
                      fontSize: '9.5px',
                      fontWeight: 600,
                      background: isBlocked ? '#b91c1c' : 'transparent',
                      color: isBlocked ? '#ffffff' : '#8b949e',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Block
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Transparency Note: eX Face Lock Camera */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 8px',
        fontSize: '9.5px',
        color: '#6e7681',
        borderTop: '1px solid #21262d',
        marginTop: 2,
      }}>
        <span>Biometric Subsystem:</span>
        <span style={{ color: exCameraActive ? '#38bdf8' : '#6e7681', fontWeight: 500 }}>
          {exCameraActive ? 'Active (Biometric verification)' : 'Standby'}
        </span>
      </div>
    </div>
  );
}

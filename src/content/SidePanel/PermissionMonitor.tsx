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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted, #888)' }}>
          Site Access & Permissions
        </span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent, #2452ff)',
              fontSize: '10px',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '2px',
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
          background: 'rgba(255, 149, 0, 0.1)',
          border: '1px solid #ff9500',
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          fontSize: '11px',
          color: '#fff',
        }}>
          <span>Are you sure you want to permanently <strong>ALLOW</strong> {confirmAllowCap} access for {hostname || 'this site'}?</span>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setConfirmAllowCap(null)}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}
            >
              Cancel
            </button>
            <button
              onClick={confirmAllow}
              style={{ background: '#34c759', border: 'none', color: '#000', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, cursor: 'pointer', fontSize: '10px' }}
            >
              Confirm Allow
            </button>
          </div>
        </div>
      )}

      {/* 5 Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {rows.map((row) => {
          const rawState = permissions[row.stateKey] || 'ask';
          const isAllowed = rawState === 'granted' || rawState === 'allow';
          const isBlocked = rawState === 'denied' || rawState === 'block';
          const isAsk = !isAllowed && !isBlocked;

          return (
            <div
              key={row.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: '44px',
                padding: '6px 10px',
                background: row.activeNow ? 'rgba(255, 59, 48, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                border: row.activeNow ? '1px solid rgba(255, 59, 48, 0.35)' : '1px solid var(--panel-border, rgba(255, 255, 255, 0.07))',
                borderRadius: '6px',
              }}
            >
              {/* Left Column: Icon + Name & Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <span style={{ fontSize: '15px' }}>{row.icon}</span>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#fff' }}>{row.name}</span>
                    {row.activeNow ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '9px',
                        fontWeight: 700,
                        color: '#ff453a',
                      }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ff453a' }} />
                        In use
                      </span>
                    ) : (
                      <span style={{ fontSize: '9px', color: 'var(--text-muted, #777)' }}>Idle</span>
                    )}
                  </div>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted, #888)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.description}
                  </span>
                </div>
              </div>

              {/* Right Column: State Chip + Segmented Control */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {/* State Chip */}
                <span style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  padding: '2px 5px',
                  borderRadius: '3px',
                  textTransform: 'uppercase',
                  background: isAllowed ? 'rgba(52, 199, 89, 0.15)' : isBlocked ? 'rgba(255, 59, 48, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  color: isAllowed ? '#34c759' : isBlocked ? '#ff453a' : 'var(--text-muted, #888)',
                  border: isAllowed ? '1px solid rgba(52, 199, 89, 0.4)' : isBlocked ? '1px solid rgba(255, 59, 48, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                }}>
                  {isAllowed ? 'Allowed' : isBlocked ? 'Blocked' : 'Ask'}
                </span>

                {/* Segmented Control: Allow | Block */}
                <div style={{
                  display: 'flex',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}>
                  <button
                    type="button"
                    onClick={() => handleToggle(row.id, 'allow')}
                    aria-pressed={isAllowed}
                    style={{
                      padding: '3px 7px',
                      fontSize: '9px',
                      fontWeight: 600,
                      background: isAllowed ? '#34c759' : 'transparent',
                      color: isAllowed ? '#000' : 'var(--text-secondary, #aaa)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    Allow
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggle(row.id, 'block')}
                    aria-pressed={isBlocked}
                    style={{
                      padding: '3px 7px',
                      fontSize: '9px',
                      fontWeight: 600,
                      background: isBlocked ? '#ff3b30' : 'transparent',
                      color: isBlocked ? '#fff' : 'var(--text-secondary, #aaa)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
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
        padding: '4px 6px',
        fontSize: '9px',
        color: 'var(--text-muted, #777)',
      }}>
        <span>eX Face Lock camera:</span>
        <span style={{ color: exCameraActive ? '#00ffd2' : 'var(--text-muted, #777)' }}>
          {exCameraActive ? '● In use (biometric verify)' : 'Idle'}
        </span>
      </div>
    </div>
  );
}

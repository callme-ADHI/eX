/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  eX — Permission & Access Monitor Component
 *  src/content/SidePanel/PermissionMonitor.tsx
 *
 *  Live indicators for browser permissions & active hardware streams:
 *  Camera, Mic, Geolocation, Screen, Notifications, Clipboard, Sensors,
 *  USB/Bluetooth, MIDI, Pop-ups, Downloads, and eX Biometric Engine.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';

export interface PermissionStateMap {
  camera?: string;
  microphone?: string;
  geolocation?: string;
  notifications?: string;
  'clipboard-read'?: string;
  midi?: string;
  [key: string]: string | undefined;
}

export interface PermissionMonitorProps {
  permissions: PermissionStateMap;
  cameraActive?: boolean;
  micActive?: boolean;
  exCameraActive?: boolean;
  fetchCount?: number;
  onRefresh?: () => void;
}

interface PermCardConfig {
  id: string;
  title: string;
  icon: string;
  stateKey?: string;
  activeNow?: boolean;
  type: 'hardware' | 'privacy' | 'content';
}

export default function PermissionMonitor({
  permissions,
  cameraActive = false,
  micActive = false,
  exCameraActive = false,
  onRefresh,
}: PermissionMonitorProps) {
  const cards: PermCardConfig[] = [
    {
      id: 'camera',
      title: 'Webcam',
      icon: '📷',
      stateKey: 'camera',
      activeNow: cameraActive,
      type: 'hardware',
    },
    {
      id: 'mic',
      title: 'Microphone',
      icon: '🎙️',
      stateKey: 'microphone',
      activeNow: micActive,
      type: 'hardware',
    },
    {
      id: 'geo',
      title: 'Location',
      icon: '📍',
      stateKey: 'geolocation',
      activeNow: false,
      type: 'privacy',
    },
    {
      id: 'notif',
      title: 'Notifications',
      icon: '🔔',
      stateKey: 'notifications',
      activeNow: false,
      type: 'content',
    },
    {
      id: 'clip',
      title: 'Clipboard',
      icon: '📋',
      stateKey: 'clipboard-read',
      activeNow: false,
      type: 'privacy',
    },
    {
      id: 'screen',
      title: 'Screen Capture',
      icon: '🖥️',
      activeNow: false,
      type: 'hardware',
    },
    {
      id: 'sensors',
      title: 'Motion & Gyro',
      icon: '🧭',
      activeNow: false,
      type: 'hardware',
    },
    {
      id: 'usb_bt',
      title: 'USB / Bluetooth',
      icon: '🔌',
      activeNow: false,
      type: 'hardware',
    },
    {
      id: 'midi',
      title: 'MIDI Audio',
      icon: '🎹',
      stateKey: 'midi',
      activeNow: false,
      type: 'hardware',
    },
    {
      id: 'popups',
      title: 'Pop-up Windows',
      icon: '🪟',
      activeNow: false,
      type: 'content',
    },
    {
      id: 'downloads',
      title: 'Downloads',
      icon: '📥',
      activeNow: false,
      type: 'content',
    },
    {
      id: 'ex_camera',
      title: 'eX Face Engine',
      icon: '🛡️',
      activeNow: exCameraActive,
      type: 'hardware',
    },
  ];

  const getStatusBadge = (card: PermCardConfig) => {
    if (card.activeNow) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          background: 'rgba(255, 59, 48, 0.2)',
          border: '1px solid rgba(255, 59, 48, 0.6)',
          color: '#ff453a',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '9px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ff453a', animation: 'ex-pulse 1s infinite' }} />
          ACTIVE NOW
        </span>
      );
    }

    const state = card.stateKey ? permissions[card.stateKey] : 'prompt';

    if (state === 'granted') {
      return (
        <span style={{
          background: 'rgba(52, 199, 89, 0.15)',
          border: '1px solid rgba(52, 199, 89, 0.4)',
          color: '#34c759',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '9px',
          fontWeight: 600,
          textTransform: 'uppercase',
        }}>
          ALLOWED
        </span>
      );
    }

    if (state === 'denied') {
      return (
        <span style={{
          background: 'rgba(255, 59, 48, 0.15)',
          border: '1px solid rgba(255, 59, 48, 0.4)',
          color: '#ff453a',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '9px',
          fontWeight: 600,
          textTransform: 'uppercase',
        }}>
          BLOCKED
        </span>
      );
    }

    return (
      <span style={{
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: 'var(--text-muted, #888)',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '9px',
        fontWeight: 500,
        textTransform: 'uppercase',
      }}>
        ASK (PROMPT)
      </span>
    );
  };

  const activeCount = cards.filter((c) => c.activeNow).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted, #888)' }}>
            Permission & Access Monitor
          </span>
          {activeCount > 0 && (
            <span style={{
              background: '#ff453a',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 800,
              padding: '1px 5px',
              borderRadius: '10px',
            }}>
              {activeCount} active
            </span>
          )}
        </div>
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

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '6px',
      }}>
        {cards.map((c) => (
          <div
            key={c.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '7px 9px',
              background: c.activeNow ? 'rgba(255, 59, 48, 0.06)' : 'rgba(255, 255, 255, 0.02)',
              border: c.activeNow ? '1px solid rgba(255, 59, 48, 0.3)' : '1px solid var(--panel-border, rgba(255,255,255,0.07))',
              borderRadius: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
              <span style={{ fontSize: '13px' }}>{c.icon}</span>
              <span style={{ fontSize: '11px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.title}
              </span>
            </div>
            {getStatusBadge(c)}
          </div>
        ))}
      </div>
    </div>
  );
}

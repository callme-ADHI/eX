import React, { useState } from 'react';
import { getPresetSvg } from '../../shared/presetIcons';
import styles from './IconRenderer.module.css';

interface IconRendererProps {
  icon: string;
  name: string;
  url?: string;
  size?: number;
}

export function IconRenderer({ icon, name, url, size = 20 }: IconRendererProps) {
  const [error, setError] = useState(false);

  if (!icon) return null;

  // 1. Check preset vector icons first (e.g. YouTube, WhatsApp, Qwen, n8n, etc.)
  const preset = getPresetSvg(url || icon || name);
  if (preset) {
    return (
      <span
        className={styles.wrapper}
        style={{
          width: `${size}px`,
          height: `${size}px`,
        }}
        dangerouslySetInnerHTML={{ __html: preset }}
      />
    );
  }

  // 2. Check if the stored icon itself is raw SVG
  if (icon.trim().startsWith('<svg')) {
    return (
      <span
        className={styles.wrapper}
        style={{
          width: `${size}px`,
          height: `${size}px`,
        }}
        dangerouslySetInnerHTML={{ __html: icon }}
      />
    );
  }

  // 3. Stylized text-initial fallback when image loading fails
  if (error) {
    return (
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size > 24 ? '14px' : '11px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          width: `${size}px`,
          height: `${size}px`,
          textTransform: 'uppercase',
          userSelect: 'none',
          background: 'var(--bg-raised)',
          border: '1px solid var(--border)',
          borderRadius: '4px'
        }}
      >
        {name ? name.charAt(0) : '?'}
      </span>
    );
  }

  // 4. Fallback to image (favicon URL or Google Favicon service URL)
  return (
    <img
      src={icon}
      alt={name}
      onError={() => setError(true)}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: 'contain',
        borderRadius: '4px',
        userSelect: 'none',
        pointerEvents: 'none'
      }}
    />
  );
}

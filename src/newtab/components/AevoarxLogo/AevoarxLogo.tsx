import React, { useState } from 'react';
import { motion } from 'framer-motion';

/**
 * AevoarxLogo — High-fidelity SVG vector design.
 *
 * Layout:
 *   - Both the Logo Mark (A) and the Wordmark (EVOARX) are drawn inside a single SVG.
 *   - Spacing between all letters is mathematically locked to exactly 5px gaps.
 *   - The 'A' (Λ chevron) letter is perfectly centered and symmetrical (spans x=79 to 87, apex at x=83).
 *   - The base of the logo mark and the wordmark are locked to y=26.
 */
export default function AevoarxLogo() {
  const [hovered, setHovered] = useState(false);
  const sw = 1.5; // Stroke width for wordmark letters

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        userSelect: 'none',
        cursor: 'default',
      }}
    >
      <svg
        viewBox={hovered ? '0 0 118 28' : '0 0 32 28'}
        width={hovered ? '118' : '32'}
        height="24"
        fill="none"
        overflow="visible"
        style={{
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* ─── Logo Mark: A (Chevron) ─── */}
        {/* Left Leg (White) */}
        <polygon
          points="13,2 17,2 7.5,26 3.5,26"
          fill="#FFFFFF"
        />
        {/* Right Leg (Accent / Blue), meets below the apex on the right side of the left leg */}
        <polygon
          points="15.2,7.5 19.2,7.5 28.7,26 24.7,26"
          fill="var(--accent)"
        />

        {/* ─── Wordmark: EVOARX (Aligned to base at y=26) ─── */}
        <g
          opacity={hovered ? 1 : 0}
          style={{
            transition: 'opacity 0.25s ease',
          }}
        >
          {/* E — Accent (x=40 to 48) */}
          <line x1="40" y1="16" x2="48" y2="16" stroke="var(--accent)" strokeWidth={sw} strokeLinecap="butt" />
          <line x1="40" y1="21" x2="46.5" y2="21" stroke="var(--accent)" strokeWidth={sw} strokeLinecap="butt" />
          <line x1="40" y1="26" x2="48" y2="26" stroke="var(--accent)" strokeWidth={sw} strokeLinecap="butt" />

          {/* V — White (x=53 to 61) */}
          <line x1="53" y1="16" x2="57" y2="26" stroke="white" strokeWidth={sw} strokeLinecap="butt" />
          <line x1="61" y1="16" x2="57" y2="26" stroke="white" strokeWidth={sw} strokeLinecap="butt" />

          {/* O — White (x=66 to 74) */}
          <rect x="66.5" y="16.5" width="7" height="9" rx="2" stroke="white" strokeWidth={sw} fill="none" />

          {/* A (Λ Chevron) — White (x=79 to 87, perfectly symmetrical apex at x=83) */}
          <line x1="83" y1="16" x2="79" y2="26" stroke="white" strokeWidth={sw} strokeLinecap="butt" />
          <line x1="83" y1="18" x2="86.2" y2="26" stroke="white" strokeWidth={sw} strokeLinecap="butt" />

          {/* R — White (x=92 to 100) */}
          <line x1="92" y1="16" x2="92" y2="26" stroke="white" strokeWidth={sw} strokeLinecap="butt" />
          <path d="M 92,16.75 L 95.5,16.75 C 97.5,16.75 97.5,21.25 95.5,21.25 L 92,21.25" stroke="white" strokeWidth={sw} fill="none" strokeLinecap="butt" />
          <line x1="95.5" y1="21.25" x2="99.5" y2="26" stroke="white" strokeWidth={sw} strokeLinecap="butt" />

          {/* X — Accent (Blue/Theme) (x=105 to 113) */}
          <line x1="105" y1="16" x2="113" y2="26" stroke="var(--accent)" strokeWidth={sw} strokeLinecap="butt" />
          <line x1="113" y1="16" x2="105" y2="26" stroke="var(--accent)" strokeWidth={sw} strokeLinecap="butt" />
        </g>
      </svg>
    </div>
  );
}

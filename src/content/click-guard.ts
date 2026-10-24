/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  eX — Click-Hijack & Ad-Redirect Detector (Isolated World Guard)
 *  src/content/click-guard.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface RecordedClick {
  t: number;
  x: number;
  y: number;
  targetTag: string;
  closestAnchorHref: string | null;
  targetIsInteractive: boolean;
  overlayHit: boolean;
}

export interface OverlayDetection {
  detected: boolean;
  selector?: string;
  href?: string;
}

const MAX_CLICKS = 20;
const CLICK_TTL_MS = 5000;
const recordedClicks: RecordedClick[] = [];

/**
 * Checks whether an element is legitimately interactive
 */
function isInteractiveElement(el: Element | null): { interactive: boolean; anchorHref: string | null } {
  if (!el) return { interactive: false, anchorHref: null };

  const anchor = el.closest('a[href]') as HTMLAnchorElement | null;
  if (anchor && anchor.href) {
    return { interactive: true, anchorHref: anchor.href };
  }

  const isBtnOrInput = Boolean(
    el.closest('button, input, select, textarea, label, summary, [role="button"], [role="link"]')
  );
  if (isBtnOrInput) {
    return { interactive: true, anchorHref: null };
  }

  return { interactive: false, anchorHref: null };
}

/**
 * Scans DOM for full-page transparent / invisible click-jacking overlays
 */
export function scanInvisibleOverlay(): OverlayDetection {
  if (typeof document === 'undefined') return { detected: false };

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const minArea = vw * vh * 0.7; // Covers >= 70% of viewport

  const candidates = document.querySelectorAll('div, a, span, section');
  for (const el of Array.from(candidates)) {
    const htmlEl = el as HTMLElement;
    const style = window.getComputedStyle(htmlEl);

    if (style.position === 'fixed' || style.position === 'absolute') {
      const z = parseInt(style.zIndex, 10);
      if (z >= 999) {
        const rect = htmlEl.getBoundingClientRect();
        const area = rect.width * rect.height;

        if (area >= minArea) {
          const opacity = parseFloat(style.opacity);
          const isTransparent =
            opacity <= 0.05 ||
            style.backgroundColor === 'transparent' ||
            style.backgroundColor === 'rgba(0, 0, 0, 0)' ||
            style.visibility === 'hidden';

          const textLen = (htmlEl.innerText || '').trim().length;
          if (isTransparent && textLen < 15) {
            const anchor = htmlEl.closest('a') || htmlEl.querySelector('a');
            return {
              detected: true,
              selector: `${htmlEl.tagName.toLowerCase()}${htmlEl.id ? '#' + htmlEl.id : ''}.${htmlEl.className.toString().slice(0, 20)}`,
              href: anchor?.href,
            };
          }
        }
      }
    }
  }

  return { detected: false };
}

/**
 * Mounts capture-phase listener to track all user clicks
 */
export function initClickGuard(onIncident?: (incident: any) => void) {
  if (typeof document === 'undefined') return;

  document.addEventListener(
    'click',
    (event) => {
      if (!event.isTrusted) return; // Only record genuine physical clicks

      const now = Date.now();
      const target = event.target as Element | null;
      const { interactive, anchorHref } = isInteractiveElement(target);
      const overlay = scanInvisibleOverlay();

      const click: RecordedClick = {
        t: now,
        x: event.clientX,
        y: event.clientY,
        targetTag: target ? target.tagName.toLowerCase() : 'unknown',
        closestAnchorHref: anchorHref,
        targetIsInteractive: interactive,
        overlayHit: overlay.detected,
      };

      // Discard older than 5s
      while (recordedClicks.length > 0 && now - recordedClicks[0].t > CLICK_TTL_MS) {
        recordedClicks.shift();
      }

      recordedClicks.push(click);
      if (recordedClicks.length > MAX_CLICKS) {
        recordedClicks.shift();
      }

      // Notify background of click context
      chrome.runtime.sendMessage({
        type: 'RECORD_TRUSTED_CLICK',
        click,
      }).catch(() => {});
    },
    { capture: true, passive: true }
  );

  // Initial overlay scan
  setTimeout(() => {
    const overlay = scanInvisibleOverlay();
    if (overlay.detected) {
      chrome.runtime.sendMessage({
        type: 'OVERLAY_DETECTED',
        overlay,
      }).catch(() => {});
    }
  }, 1200);
}

export function getRecentClicks(): RecordedClick[] {
  const now = Date.now();
  return recordedClicks.filter((c) => now - c.t <= CLICK_TTL_MS);
}

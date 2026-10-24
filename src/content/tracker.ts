/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  eX Security Extension — MAIN World Execution Hooks
 *  src/content/tracker.ts
 *
 *  Instruments window.open, location changes, script-triggered clicks,
 *  global capture handlers, and media hardware access.
 * ─────────────────────────────────────────────────────────────────────────────
 */

(() => {
  let cameraCount = 0;
  let micCount = 0;
  let fetchCount = 0;
  let globalClickHandlerCount = 0;
  let lastTrustedClickTime = 0;

  // Track physical user click timestamps in the page
  window.addEventListener(
    'click',
    (e) => {
      if (e.isTrusted) lastTrustedClickTime = Date.now();
    },
    { capture: true, passive: true }
  );

  const reportAccess = (extra?: Record<string, any>) => {
    window.dispatchEvent(
      new CustomEvent('ex:api_access', {
        detail: {
          cameraCount,
          micCount,
          fetchCount,
          globalClickHandlerCount,
          ...(extra || {}),
        },
      })
    );
  };

  // 1. Intercept window.open
  if (typeof window.open === 'function') {
    const origOpen = window.open;
    window.open = function(url?: string | URL, target?: string, features?: string) {
      const clickAge = Date.now() - lastTrustedClickTime;
      reportAccess({
        windowOpenCall: {
          url: url ? String(url) : null,
          target: target || null,
          features: features || null,
          clickAge,
        },
      });
      return origOpen.apply(this, [url as any, target as any, features as any]);
    };
  }

  // 2. Intercept document.addEventListener for global click hijacking
  const origAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type: string, listener: any, options?: any) {
    if (type === 'click' && (this === window || this === document || this === document.body)) {
      globalClickHandlerCount++;
      reportAccess();
    }
    return origAddEventListener.apply(this, [type, listener, options]);
  };

  // 3. Intercept HTMLAnchorElement.prototype.click
  if (HTMLAnchorElement.prototype.click) {
    const origAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function() {
      const clickAge = Date.now() - lastTrustedClickTime;
      // Script triggered click on link within 50ms of real user click
      if (clickAge <= 150) {
        reportAccess({
          scriptAnchorClick: {
            href: this.href || null,
            target: this.target || null,
            clickAge,
          },
        });
      }
      return origAnchorClick.apply(this);
    };
  }

  // 4. Intercept getUserMedia
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async function(constraints) {
      if (constraints) {
        if (constraints.video) cameraCount++;
        if (constraints.audio) micCount++;
        reportAccess();
      }
      return origGetUserMedia(constraints);
    };
  }

  // 5. Intercept fetch
  if (window.fetch) {
    const origFetch = window.fetch;
    window.fetch = async function(...args) {
      fetchCount++;
      reportAccess();
      return origFetch.apply(this, args);
    };
  }

  // 6. Intercept XHR
  if (window.XMLHttpRequest) {
    const origXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: any[]) {
      fetchCount++;
      reportAccess();
      return (origXhrOpen as any).apply(this, [method, url, ...args]);
    };
  }
})();

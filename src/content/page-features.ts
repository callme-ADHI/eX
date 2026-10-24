import { BRANDS } from '../detectors/topdomains';
import type { PageFeatures } from '../detectors/tier0-page';

export function extractPageFeatures(): PageFeatures {
  const currentHost = window.location.hostname.toLowerCase();

  // 1. Password input & login forms
  const pwdInput = document.querySelector('input[type="password"]');
  const hasPasswordInput = Boolean(pwdInput);

  const forms = Array.from(document.querySelectorAll('form'));
  let formActionCrossDomain = false;
  const formActions: string[] = [];

  for (const form of forms) {
    const action = form.getAttribute('action') || '';
    if (action) {
      formActions.push(action);
      try {
        const actionUrl = new URL(action, window.location.href);
        if (actionUrl.hostname && actionUrl.hostname !== currentHost) {
          formActionCrossDomain = true;
        }
      } catch (_) {}
    }
  }

  const hasLoginForm = hasPasswordInput || forms.some((f) => {
    return Boolean(f.querySelector('input[name*="user" i], input[name*="login" i], input[name*="email" i]'));
  });

  // 2. Hidden iframes
  const iframes = Array.from(document.querySelectorAll('iframe'));
  let iframeHiddenCount = 0;
  for (const iframe of iframes) {
    const style = window.getComputedStyle(iframe);
    const w = iframe.offsetWidth || parseInt(iframe.getAttribute('width') || '0', 10);
    const h = iframe.offsetHeight || parseInt(iframe.getAttribute('height') || '0', 10);
    if (style.display === 'none' || style.visibility === 'hidden' || (w <= 2 && h <= 2)) {
      iframeHiddenCount++;
    }
  }

  // 3. Scripts and external ratio
  const scripts = Array.from(document.querySelectorAll('script'));
  let externalCount = 0;
  let hasObfuscatedJS = false;

  for (const s of scripts) {
    if (s.src) {
      try {
        const scriptHost = new URL(s.src, window.location.href).hostname;
        if (scriptHost && scriptHost !== currentHost) externalCount++;
      } catch (_) {}
    } else if (s.textContent) {
      const code = s.textContent;
      if (/(eval\s*\(|unescape\s*\(|fromCharCode|\\x[0-9a-f]{2}|\\u[0-9a-f]{4})/i.test(code)) {
        hasObfuscatedJS = true;
      }
    }
  }
  const externalScriptRatio = scripts.length > 0 ? externalCount / scripts.length : 0;

  // 4. Brand mentions
  const titleText = document.title || '';
  const h1Text = Array.from(document.querySelectorAll('h1')).map((h) => h.textContent || '').join(' ');
  const combinedHeader = `${titleText} ${h1Text}`.toLowerCase();
  const visibleBrandMentions: string[] = [];

  for (const b of BRANDS) {
    if (combinedHeader.includes(b.brand) && !b.domains.some((d) => d === currentHost || currentHost.endsWith(`.${d}`))) {
      visibleBrandMentions.push(b.brand);
    }
  }

  // 5. Favicon
  let faviconHost = '';
  let faviconCrossDomain = false;
  const iconLink = document.querySelector('link[rel*="icon"]') as HTMLLinkElement | null;
  if (iconLink?.href) {
    try {
      const fUrl = new URL(iconLink.href, window.location.href);
      faviconHost = fUrl.hostname;
      if (faviconHost && faviconHost !== currentHost) {
        faviconCrossDomain = true;
      }
    } catch (_) {}
  }

  // 6. Snippet
  const textSnippet = (document.body?.innerText || '').slice(0, 300).replace(/\s+/g, ' ').trim();

  return {
    hasPasswordInput,
    hasLoginForm,
    formActionCrossDomain,
    formActions: formActions.slice(0, 5),
    iframeHiddenCount,
    externalScriptRatio,
    titleText: titleText.slice(0, 150),
    visibleBrandMentions: visibleBrandMentions.slice(0, 3),
    hasObfuscatedJS,
    hasRightClickBlock: Boolean(document.oncontextmenu),
    hasCopyPasteBlock: Boolean(document.oncopy || document.onpaste),
    faviconHost,
    faviconCrossDomain,
    textSnippet,
  };
}

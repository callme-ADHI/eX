/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  eX — Legitimate Auth & Payment Popups Whitelist
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const AUTH_POPUP_HOSTS: Set<string> = new Set([
  "accounts.google.com",
  "appleid.apple.com",
  "login.microsoftonline.com",
  "login.live.com",
  "facebook.com",
  "auth.meta.com",
  "twitter.com",
  "x.com",
  "github.com",
  "gitlab.com",
  "linkedin.com",
  "paypal.com",
  "checkout.stripe.com",
  "api.stripe.com",
  "razorpay.com",
  "api.razorpay.com",
  "paytm.com",
  "secure.payu.in",
  "billdesk.com",
  "ccavenue.com"
]);
export function isAuthPopup(urlOrHostname: string): boolean {
  try {
    const host = (urlOrHostname.includes("://") ? new URL(urlOrHostname).hostname : urlOrHostname).toLowerCase().replace(/^www\./, "");
    if (AUTH_POPUP_HOSTS.has(host)) return true;
    for (const h of AUTH_POPUP_HOSTS) {
      if (host.endsWith("." + h)) return true;
    }
  } catch {}
  return false;
}

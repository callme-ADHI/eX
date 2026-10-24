/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  eX — Mail Page Detection
 *  src/shared/mail-pages.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

const MAIL_HOSTNAMES = new Set([
  'mail.google.com',
  'inbox.google.com',
  'outlook.live.com',
  'outlook.office.com',
  'outlook.office365.com',
  'mail.yahoo.com',
  'mail.proton.me',
  'mail.aol.com',
  'webmail.zoho.com',
]);

/**
 * Returns true if the given URL or hostname is a recognized webmail provider.
 */
export function isMailPage(urlOrHostname?: string): boolean {
  if (!urlOrHostname) return false;

  let hostname = urlOrHostname.trim().toLowerCase();

  // If it's a URL, extract hostname
  if (hostname.includes('://') || hostname.startsWith('//')) {
    try {
      const parsed = new URL(hostname.startsWith('//') ? 'https:' + hostname : hostname);
      hostname = parsed.hostname;
    } catch {
      // Fallback regex extraction
      const match = hostname.match(/^[a-z]+:\/\/([^/:]+)/);
      if (match) hostname = match[1];
    }
  }

  // Remove leading www.
  hostname = hostname.replace(/^www\./, '');

  if (MAIL_HOSTNAMES.has(hostname)) return true;

  // Subdomain match (e.g. mail.google.com on complex paths or regional hosts)
  for (const host of MAIL_HOSTNAMES) {
    if (hostname === host || hostname.endsWith('.' + host)) {
      return true;
    }
  }

  return false;
}

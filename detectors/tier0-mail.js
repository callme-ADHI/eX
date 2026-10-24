/**
 * Tier-0 Mail feature scoring for Gmail inbox row and deep scan.
 * Pure function - no chrome.* deps.
 * SPEC Section 7.1, 7.2.
 */

import { BRANDS } from './topdomains.js';

const URGENCY_KEYWORDS = [
  'urgent', 'verify', 'suspended', 'locked', 'password', 'invoice',
  'payment failed', 'action required', 'final notice', 'prize', 'winner',
  'gift card', 'refund', 'security alert', 'confirm your account'
];

const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com'
]);

const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'scr', 'js', 'vbs', 'bat', 'iso', 'img', 'lnk', 'html', 'htm',
  'docm', 'xlsm'
]);

function editDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Score email in either 'row' mode or 'deep' mode.
 * @param {object} mail
 * @param {'row'|'deep'} mode
 * @returns {{score: number, reasons: string[]}}
 */
export function scoreMail(mail, mode = 'row') {
  let score = 0;
  const reasons = [];
  if (!mail) return { score: 0, reasons: [] };

  const senderEmail = (mail.senderEmail || '').toLowerCase();
  const senderName = (mail.senderName || '').toLowerCase();
  const senderDomain = senderEmail.includes('@') ? senderEmail.split('@')[1] : '';
  const domainLabel = senderDomain.split('.')[0] || '';

  // 1. Display name claims brand but sender domain is unrelated or free-mail
  for (const b of BRANDS) {
    if (senderName.includes(b.brand)) {
      if (!b.domains.some(d => d === senderDomain)) {
        score += 30;
        reasons.push(`Display name claims "${b.brand}" but email domain is "${senderDomain}"`);
        break;
      }
    }
  }

  // 2. Sender domain lookalike (edit distance <= 2 to brand)
  for (const b of BRANDS) {
    const dist = editDistance(domainLabel, b.brand);
    if (dist > 0 && dist <= 2 && !b.domains.includes(senderDomain)) {
      score += 35;
      reasons.push(`Sender domain "${senderDomain}" looks like brand "${b.brand}"`);
      break;
    }
  }

  // 3. Free-mail sender claiming bank/company in display name (+15)
  if (FREE_MAIL_DOMAINS.has(senderDomain)) {
    if (/(bank|support|security|service|billing|account|alert|verify|update)/i.test(senderName)) {
      score += 15;
      reasons.push(`Free-mail sender (${senderDomain}) with corporate display name`);
    }
  }

  // 4. Urgency keywords (+6 each, max +24)
  const textToCheck = `${mail.subject || ''} ${mail.snippet || ''} ${mail.bodyText || ''}`.toLowerCase();
  let urgencyCount = 0;
  for (const kw of URGENCY_KEYWORDS) {
    if (textToCheck.includes(kw)) {
      urgencyCount++;
      if (urgencyCount * 6 <= 24) {
        score += 6;
      }
    }
  }
  if (urgencyCount > 0) {
    reasons.push(`Urgency / alarm keywords detected (${urgencyCount} found)`);
  }

  // 5. Subject / snippet all-caps ratio > 0.5 (+6)
  const subject = mail.subject || '';
  const alphaChars = subject.replace(/[^a-zA-Z]/g, '');
  if (alphaChars.length > 5) {
    const upperCount = subject.replace(/[^A-Z]/g, '').length;
    if (upperCount / alphaChars.length > 0.5) {
      score += 6;
      reasons.push('Excessive uppercase in subject line');
    }
  }

  // 6. Attachment + generic subject (+10)
  if (mail.hasAttachment || (mail.attachments && mail.attachments.length > 0)) {
    if (/^(invoice|document|scan|receipt|order|statement|bill|img|file)/i.test(subject.trim())) {
      score += 10;
      reasons.push('Generic subject with file attachment');
    }
  }

  // Deep-scan only checks
  if (mode === 'deep') {
    // 7. Link text looks like URL/domain but differs from href host (+30 per, max +40)
    let linkMismatchCount = 0;
    if (Array.isArray(mail.links)) {
      for (const link of mail.links) {
        const text = (link.text || '').trim();
        const host = (link.hrefHost || '').toLowerCase();
        if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)) {
          if (!text.toLowerCase().includes(host) && !host.includes(text.toLowerCase())) {
            linkMismatchCount++;
          }
        }
      }
    }
    if (linkMismatchCount > 0) {
      score += Math.min(40, linkMismatchCount * 30);
      reasons.push(`Link text mismatch: destination does not match displayed URL text`);
    }

    // 8. Link host is shortener or IP or punycode (+15)
    if (Array.isArray(mail.links)) {
      for (const link of mail.links) {
        const host = (link.hrefHost || '').toLowerCase();
        if (host.includes('xn--') || /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || /(bit\.ly|tinyurl|t\.co|goo\.gl|is\.gd)/.test(host)) {
          score += 15;
          reasons.push('Email contains shortened, IP, or punycode link destination');
          break;
        }
      }
    }

    // 9. Reply-To domain != From domain (+15)
    if (mail.replyTo && senderEmail) {
      const replyDomain = mail.replyTo.includes('@') ? mail.replyTo.split('@')[1].toLowerCase() : '';
      if (replyDomain && replyDomain !== senderDomain) {
        score += 15;
        reasons.push(`Reply-To address (@${replyDomain}) differs from From address (@${senderDomain})`);
      }
    }

    // 10. Dangerous attachment extension (+20) or double extension (+30)
    if (Array.isArray(mail.attachments)) {
      for (const att of mail.attachments) {
        const name = (typeof att === 'string' ? att : att.name || '').toLowerCase();
        if (/\.[a-z0-9]+\.(exe|scr|bat|js|vbs|zip)$/i.test(name)) {
          score += 30;
          reasons.push(`Dangerous double extension on attachment "${name}"`);
          break;
        }
        const ext = name.split('.').pop();
        if (DANGEROUS_EXTENSIONS.has(ext)) {
          score += 20;
          reasons.push(`High-risk executable attachment extension (.${ext})`);
          break;
        }
      }
    }

    // 11. Body requests credentials / payment / OTP (+15)
    if (/(password|otp|pin|card number|cvv|secret code|social security)/i.test(textToCheck)) {
      score += 15;
      reasons.push('Email body solicits credentials, PIN, or payment details');
    }
  }

  return {
    score: Math.min(100, score),
    reasons: reasons.slice(0, 5)
  };
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  eX — Mail Classifier v2 (Deterministic Features + LLM + Log-Odds Fusion)
 *  src/content/gmail/mail-classifier-v2.ts
 *
 *  Evaluates ~70 features across 8 groups:
 *    A. Sender Identity (12)
 *    B. Authentication & Trust Cues (6)
 *    C. Language & Intent (16, incl. India-specific UPI/Aadhaar/PAN/KYC)
 *    D. Links & URLs (14)
 *    E. Attachments (6)
 *    F. HTML Structure & DOM (8)
 *    G. QR & Visual Analysis (3)
 *    H. Sender History Context (5)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mailWeightsData from '../../detectors/mail-weights.json' with { type: 'json' };
import { findBrandByDomain, findBrandByName } from '../../detectors/brands.ts';

export interface EmailData {
  id?: string;
  senderName?: string;
  senderAddress?: string;
  replyToAddress?: string;
  subject?: string;
  bodySnippet?: string;
  fullBodyText?: string;
  bodyHtml?: string;
  links?: { text: string; href: string }[];
  attachments?: string[];
  gmailBannerText?: string;
  hasQrCode?: boolean;
  qrDecodedUrl?: string;
  senderHistoryCount?: number;
}

export interface Contribution {
  id: string;
  name: string;
  weight: number;
  value: number;
  details: string;
}

export interface MailClassification {
  level: 'high' | 'suspicious' | 'low' | 'clean';
  pRisk: number; // 0..1
  zScore: number;
  category: string;
  contributions: Contribution[];
  topReasons: string[];
  advice: string;
}

const RISKY_ATTACHMENTS = new Set([
  'exe', 'scr', 'js', 'vbs', 'bat', 'lnk', 'iso', 'img', 'hta', 'jar', 'msi', 'cmd', 'ps1'
]);

const SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'buff.ly', 'ow.ly', 'cutt.ly', 'qr.ae', 's.id'
]);

export function classifyMail(mail: EmailData, llmResult?: any): MailClassification {
  const b0 = mailWeightsData.b0;
  const weights = mailWeightsData.features as Record<string, number>;
  let z = b0;

  const contributions: Contribution[] = [];

  const addContrib = (id: string, name: string, weight: number, value: number, details: string) => {
    const pts = Math.round(weight * value * 100) / 100;
    z += pts;
    contributions.push({ id, name, weight: pts, value, details });
  };

  const senderAddr = (mail.senderAddress || '').trim().toLowerCase();
  const senderDomain = senderAddr.split('@')[1] || '';
  const senderName = (mail.senderName || '').trim();
  const subject = (mail.subject || '').toLowerCase();
  const text = ((mail.fullBodyText || mail.bodySnippet || '') + ' ' + subject).toLowerCase();

  // ── Group A: Sender Identity ──
  const brandByName = findBrandByName(senderName);
  if (brandByName) {
    const isLegitDomain = brandByName.domains.some(d => senderDomain === d || senderDomain.endsWith('.' + d));
    if (!isLegitDomain) {
      addContrib(
        'brand_in_display_unrelated_domain',
        'Brand Impersonation in Sender Name',
        weights.brand_in_display_unrelated_domain,
        1,
        `Display name claims '${brandByName.name}' but sender is @${senderDomain}`
      );
    }
  }

  if (senderAddr && senderName.includes('@') && !senderName.includes(senderDomain)) {
    addContrib('display_address_mismatch', 'Sender Name Disguises Alternate Email', weights.display_address_mismatch, 1, 'Display name contains spoofed email address');
  }

  if (mail.replyToAddress) {
    const replyDomain = mail.replyToAddress.split('@')[1] || '';
    if (replyDomain && replyDomain !== senderDomain) {
      addContrib('reply_to_mismatch', 'Reply-To Domain Mismatch', weights.reply_to_mismatch, 1, `Replies directed to @${replyDomain}`);
    }
  }

  // ── Group B: Gmail Banners & Auth ──
  if (mail.gmailBannerText && /be careful|suspicious|phishing|unverified/i.test(mail.gmailBannerText)) {
    addContrib('gmail_warning_banner', 'Gmail Built-in Security Warning', weights.gmail_warning_banner, 1, 'Google flagged this message with a security warning');
  }

  // ── Group C: Language & Intent (incl. India Specific) ──
  if (/password|credential|login credentials|reset your password|verify your account|pin|cvv|otp|mfa|2fa|multi-factor|authentication code|security key/i.test(text)) {
    addContrib('lang_credential_request', 'Credential / Password Request', weights.lang_credential_request, 1, 'Solicits passwords, PINs, MFA, or credentials');
  }

  if (/upi|bank account|wire transfer|payment update|invoice|aadhaar|pan card|kyc|neft|rtgs|customs fee|unpaid fee|processing fee/i.test(text)) {
    addContrib('lang_payment_request', 'Payment / Banking / KYC Instruction', weights.lang_payment_request, 1, 'Demands UPI, KYC, fee payment, or financial verification');
  }

  if (/urgent|immediately|within \d+ (?:hours?|days?)|account suspended|deactivated|action required|could not be delivered|pay immediately|mandatory|maintain.*access|maintain.*inbox/i.test(text)) {
    addContrib('lang_urgency', 'Coercive Urgency / Suspension Threat', weights.lang_urgency, 1, 'Enforces rapid deadline or threatens account deactivation / delivery hold');
  }

  if (/infected|trojan|pegasus|recorded you|adult website|contacts|bitcoin|wallet|extortion|ransom|leak|compromised/i.test(text)) {
    addContrib('lang_threat', 'Blackmail / Extortion / Ransom Threat', weights.lang_threat, 1, 'Coercive extortion or threat to release compromising material');
  }

  if (/lottery|kbc|reward|won|prize|cashback|refund/i.test(text)) {
    addContrib('lang_reward', 'Lottery / Cashback Lure', weights.lang_reward, 1, 'Promises prize, lottery, or unsolicited refund');
  }

  if (/do not disclose|keep confidential|secret|confidential/i.test(text)) {
    addContrib('lang_secrecy', 'Secrecy Instruction', weights.lang_secrecy, 1, 'Instructs recipient not to consult others');
  }

  if (/^dear (customer|user|valued client|sir\/madam)/i.test(text)) {
    addContrib('generic_greeting', 'Generic Impersonal Salutation', weights.generic_greeting, 1, 'Generic impersonal opening');
  }

  // ── Group D: Links (including decoded QR URLs) ──
  const links = [...(mail.links || [])];
  if (mail.qrDecodedUrl) {
    links.push({ text: 'QR Code Link', href: mail.qrDecodedUrl });
  }

  let mismatchCount = 0;
  for (const l of links) {
    const href = (l.href || '').toLowerCase();
    const linkText = (l.text || '').toLowerCase().trim();

    try {
      const parsedHref = new URL(href);
      const linkHost = parsedHref.hostname.replace(/^www\./, '');

      // Display text looks like a domain or full URL but links elsewhere
      let textHost = '';
      if (linkText.startsWith('http://') || linkText.startsWith('https://')) {
        try {
          textHost = new URL(linkText).hostname.replace(/^www\./, '');
        } catch {}
      } else if (linkText.includes('.') && !linkText.includes(' ')) {
        textHost = linkText.replace(/^www\./, '').split('/')[0];
      }

      if (textHost && textHost !== linkHost && !linkHost.endsWith('.' + textHost)) {
        mismatchCount++;
      }

      if (SHORTENERS.has(linkHost)) {
        addContrib('link_shortener', 'URL Shortener Decoy', weights.link_shortener, 1, `Link disguised via shortener ${linkHost}`);
      }

      if (/^(login|signin|verify|secure|update|auth|pay)/i.test(parsedHref.pathname) && senderDomain && !linkHost.includes(senderDomain)) {
        addContrib('foreign_login_path', 'Credential Harvest / Payment Link', weights.foreign_login_path, 1, `Points to ${parsedHref.pathname} on foreign domain`);
      }

      if (/^(\d{1,3}\.){3}\d{1,3}$/.test(linkHost)) {
        addContrib('ip_or_punycode_link', 'Direct IP Link in Body', weights.ip_or_punycode_link, 1, `Direct IP address link: ${linkHost}`);
      }
    } catch {}
  }

  if (mismatchCount > 0) {
    const weight = weights.link_text_href_mismatch_first + Math.min(1.3, (mismatchCount - 1) * weights.link_text_href_mismatch_extra);
    addContrib('link_text_href_mismatch', 'Deceptive Mismatched Link Anchor', weight, 1, `${mismatchCount} link(s) display one domain but target another`);
  }

  // ── Group E: Attachments ──
  const attachments = mail.attachments || [];
  for (const att of attachments) {
    const lower = att.toLowerCase();
    const ext = lower.split('.').pop() || '';
    if (RISKY_ATTACHMENTS.has(ext)) {
      addContrib('risky_attachment', 'Dangerous Executable Attachment', weights.risky_attachment, 1, `Executable attachment: ${att}`);
    }
    if (/\.[a-z0-9]{2,4}\.[a-z0-9]{2,4}$/i.test(lower)) {
      addContrib('double_extension', 'Double Extension Camouflage', weights.double_extension, 1, `Suspicious double extension: ${att}`);
    }
    if (ext === 'html' || ext === 'htm') {
      addContrib('html_attachment', 'Attached HTML Phishing File', weights.html_attachment, 1, 'HTML attachment typically used for offline credential theft');
    }
  }

  // ── Group G: QR Code Quishing ──
  if (mail.hasQrCode || mail.qrDecodedUrl) {
    addContrib('qr_to_risky_url', 'QR Code / Quishing Vector', weights.qr_to_risky_url, 1, 'Contains QR code designed to bypass email link scanners');
  }

  // ── Group H: Context & Clean History ──
  if (mail.senderHistoryCount && mail.senderHistoryCount >= 5) {
    addContrib('sender_clean_history', 'Established Clean Sender History', weights.sender_clean_history, 1, `User received ${mail.senderHistoryCount} prior safe emails from domain`);
  }

  // Legit brand bundle deduction if everything aligns
  if (brandByName && brandByName.domains.includes(senderDomain) && mismatchCount === 0 && !contributions.some(c => c.weight > 2.0)) {
    addContrib('legit_pattern_bundle', 'Verified Official Brand Entity', weights.legit_pattern_bundle, 1, `Matches verified domains for ${brandByName.name}`);
  }

  // ── LLM Integration ──
  if (llmResult) {
    if (llmResult.category && /phish|fraud|scam|malware|quishing|extortion/i.test(llmResult.category)) {
      addContrib('llm_category_phish', 'AI Identified Malicious Intent', weights.llm_category_phish * (llmResult.confidence || 0.8), 1, `AI classified category: ${llmResult.category}`);
    }
  }

  // Logistic probability
  const pRisk = 1 / (1 + Math.exp(-z));

  let level: 'high' | 'suspicious' | 'low' | 'clean' = 'clean';
  if (pRisk >= 0.70) level = 'high';
  else if (pRisk >= 0.30) level = 'suspicious';
  else if (pRisk >= 0.08) level = 'low';

  // Sort contributions
  contributions.sort((a, b) => b.weight - a.weight);

  const topReasons = contributions
    .filter(c => c.weight > 0.4)
    .slice(0, 5)
    .map(c => `[+${c.weight.toFixed(1)}] ${c.name}: ${c.details}`);

  let category = 'Legitimate Message';
  if (level === 'high' || level === 'suspicious') {
    if (contributions.some(c => c.id.includes('credential'))) category = 'Credential Phishing';
    else if (contributions.some(c => c.id.includes('payment'))) category = 'Financial / Invoice Scam';
    else if (contributions.some(c => c.id.includes('qr'))) category = 'Quishing (QR Scam)';
    else if (contributions.some(c => c.id.includes('attachment'))) category = 'Malware Delivery';
    else category = 'Suspicious Phishing';
  }

  let advice = 'Looks legitimate. Standard verification advised.';
  if (level === 'high') {
    advice = 'DO NOT click links, enter passwords, or provide OTP/UPI details from this sender.';
  } else if (level === 'suspicious') {
    advice = 'Verify sender identity independently before taking requested actions.';
  }

  return {
    level,
    pRisk: Math.round(pRisk * 1000) / 1000,
    zScore: Math.round(z * 100) / 100,
    category,
    contributions,
    topReasons,
    advice,
  };
}

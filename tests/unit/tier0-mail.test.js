import assert from 'node:assert';
import { scoreMail } from '../../detectors/tier0-mail.js';

console.log('Testing scoreMail()...');

// 1. Normal legitimate email
const m1 = scoreMail({
  senderEmail: 'alice@company.org',
  senderName: 'Alice Smith',
  subject: 'Project kickoff notes',
  snippet: 'Hey team, here are the meeting notes from this morning.',
}, 'row');
assert.strictEqual(m1.score, 0);
assert.strictEqual(m1.reasons.length, 0);

// 2. Display name claims brand with unrelated domain
const m2 = scoreMail({
  senderEmail: 'support-ticket@randomsite.biz',
  senderName: 'PayPal Security Team',
  subject: 'Account update notice',
  snippet: 'Review your account',
}, 'row');
assert.ok(m2.score >= 30);
assert.ok(m2.reasons.some(r => r.includes('Display name claims "paypal"')));

// 3. Sender domain lookalike
const m3 = scoreMail({
  senderEmail: 'service@paypa1.com',
  senderName: 'Service',
  subject: 'Notice',
  snippet: 'Details enclosed',
}, 'row');
assert.ok(m3.score >= 35);
assert.ok(m3.reasons.some(r => r.includes('looks like brand "paypal"')));

// 4. Free-mail sender with corporate display name
const m4 = scoreMail({
  senderEmail: 'user99823@gmail.com',
  senderName: 'Bank of America Support',
  subject: 'Account statement',
  snippet: 'Your statement is ready',
}, 'row');
assert.ok(m4.score >= 15);

// 5. Urgency keywords
const m5 = scoreMail({
  senderEmail: 'notifier@updates.net',
  senderName: 'Notification',
  subject: 'URGENT: account suspended, action required immediately',
  snippet: 'Verify your password now or your account will be locked.',
}, 'row');
assert.ok(m5.score >= 18);
assert.ok(m5.reasons.some(r => r.includes('Urgency')));

// 6. Excessive uppercase in subject line
const m6 = scoreMail({
  senderEmail: 'promo@shop.com',
  senderName: 'Store',
  subject: 'FINAL NOTICE CLAIM YOUR PRIZE WINNER',
  snippet: 'Congratulations you won a gift card.',
}, 'row');
assert.ok(m6.reasons.some(r => r.includes('uppercase')));

// 7. Generic subject with file attachment
const m7 = scoreMail({
  senderEmail: 'accounts@vendor.com',
  senderName: 'Billing',
  subject: 'Invoice #84920',
  snippet: 'Please see attached.',
  hasAttachment: true,
}, 'row');
assert.ok(m7.reasons.some(r => r.includes('Generic subject with file attachment')));

// 8. Deep mode: link text mismatch
const m8 = scoreMail({
  senderEmail: 'alerts@chase.com',
  senderName: 'Chase',
  subject: 'Security review',
  bodyText: 'Click here to verify: https://chase.com/login',
  links: [{ text: 'chase.com/login', hrefHost: 'evil-phish.ru' }],
}, 'deep');
assert.ok(m8.score >= 30);
assert.ok(m8.reasons.some(r => r.includes('Link text mismatch')));

// 9. Deep mode: link host is shortener or IP
const m9 = scoreMail({
  senderEmail: 'team@notify.com',
  senderName: 'Team',
  subject: 'Doc shared',
  bodyText: 'View document at the link below',
  links: [{ text: 'Document', hrefHost: 'bit.ly' }],
}, 'deep');
assert.ok(m9.reasons.some(r => r.includes('shortened')));

// 10. Deep mode: Reply-To domain differs from From domain
const m10 = scoreMail({
  senderEmail: 'billing@microsoft.com',
  senderName: 'Microsoft Cloud',
  replyTo: 'steve@hacker-mailbox.net',
  subject: 'Invoice confirmation',
  bodyText: 'Thank you for your order.',
}, 'deep');
assert.ok(m10.reasons.some(r => r.includes('Reply-To address')));

// 11. Deep mode: dangerous executable double extension
const m11 = scoreMail({
  senderEmail: 'hr@partner-co.com',
  senderName: 'HR Recruiter',
  subject: 'Resume review',
  bodyText: 'Please review the candidate resume attached.',
  attachments: [{ name: 'Candidate_Resume.pdf.exe' }],
}, 'deep');
assert.ok(m11.score >= 30);
assert.ok(m11.reasons.some(r => r.includes('Dangerous double extension')));

// 12. Deep mode: body requests credentials / OTP
const m12 = scoreMail({
  senderEmail: 'auth-security@bank-alert.co',
  senderName: 'Security',
  subject: 'Verification Required',
  bodyText: 'Please reply with your one-time OTP and password to confirm your identity.',
}, 'deep');
assert.ok(m12.reasons.some(r => r.includes('solicits credentials')));

// 13. Null input handled safely
const m13 = scoreMail(null);
assert.strictEqual(m13.score, 0);

console.log('✓ All 13 tier0-mail test cases passed.');

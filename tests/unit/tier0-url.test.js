import assert from 'node:assert';
import { scoreSiteUrl } from '../../detectors/tier0-url.js';

console.log('Testing scoreSiteUrl()...');

// 1. Trusted domain -> 0 score
const t1 = scoreSiteUrl('https://www.google.com/search?q=cybersecurity');
assert.strictEqual(t1.score, 0);
assert.strictEqual(t1.reasons.length, 0);

// 2. IP address host -> at least 25
const t2 = scoreSiteUrl('http://192.0.2.1/login.php');
assert.ok(t2.score >= 25);
assert.ok(t2.reasons.some(r => r.includes('IP address')));

// 3. Punycode homograph -> at least 25
const t3 = scoreSiteUrl('https://xn--app-9oa.com');
assert.ok(t3.score >= 25);
assert.ok(t3.reasons.some(r => r.includes('Punycode')));

// 4. @ trick in URL -> at least 20
const t4 = scoreSiteUrl('https://google.com@evil-site.com/login');
assert.ok(t4.score >= 20);
assert.ok(t4.reasons.some(r => r.includes('@')));

// 5. Suspicious TLD (.xyz, .tk, .top)
const t5 = scoreSiteUrl('https://mybank-update.xyz/verify');
assert.ok(t5.score >= 10);
assert.ok(t5.reasons.some(r => r.includes('suspicious TLD') || r.includes('xyz')));

// 6. Excessive subdomain depth >= 4
const t6 = scoreSiteUrl('https://a.b.c.d.evilportal.com');
assert.ok(t6.score >= 10);
assert.ok(t6.reasons.some(r => r.includes('subdomain depth')));

// 7. Long URL > 100 chars
const longPath = 'a'.repeat(120);
const t7 = scoreSiteUrl(`https://example-portal.com/${longPath}`);
assert.ok(t7.score >= 8);
assert.ok(t7.reasons.some(r => r.includes('long URL')));

// 8. Known URL shortener
const t8 = scoreSiteUrl('https://bit.ly/3xY9zq');
assert.ok(t8.score >= 10);
assert.ok(t8.reasons.some(r => r.includes('shortener')));

// 9. Typosquatted brand (e.g. go0gle or paypa1 or amzon)
const t9 = scoreSiteUrl('https://paypa1.com');
assert.ok(t9.score > 0);

// 10. Legitimate HTTPS site
const t10 = scoreSiteUrl('https://github.com/torvalds/linux');
assert.strictEqual(t10.score, 0);

// 11. Malformed URL string gracefully handled
const t11 = scoreSiteUrl('not-a-valid-url');
assert.strictEqual(t11.score, 0);

console.log('✓ All tier0-url tests passed.');

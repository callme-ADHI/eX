import assert from 'node:assert';
import { validate } from '../../detectors/schemas.js';

console.log('Testing schemas.js...');

// 1. Verdict schema - valid
const validVerdict = {
  level: 'safe',
  confidence: 0.95,
  reasons: ['No suspicious patterns detected', 'Valid domain']
};
assert.strictEqual(validate('verdict', validVerdict).ok, true);

// 2. Verdict schema - invalid enum
assert.strictEqual(validate('verdict', { ...validVerdict, level: 'unknown' }).ok, false);

// 3. Verdict schema - confidence out of range
assert.strictEqual(validate('verdict', { ...validVerdict, confidence: 1.5 }).ok, false);
assert.strictEqual(validate('verdict', { ...validVerdict, confidence: -0.1 }).ok, false);

// 4. Verdict schema - too many reasons
const tooManyReasons = ['1', '2', '3', '4', '5', '6'];
assert.strictEqual(validate('verdict', { ...validVerdict, reasons: tooManyReasons }).ok, false);

// 5. mailBatch schema - valid
const validBatch = [
  { i: 'row123', risk: 'high', why: 'Display name lookalike brand mismatch' },
  { i: 'row456', risk: 'low', why: 'Normal transaction' }
];
assert.strictEqual(validate('mailBatch', validBatch).ok, true);

// 6. mailBatch schema - invalid risk enum
assert.strictEqual(validate('mailBatch', [{ i: 'r', risk: 'critical', why: 'urgent' }]).ok, false);

// 7. mailDeep schema - valid
const validDeep = {
  level: 'dangerous',
  confidence: 0.9,
  reasons: ['Fake login form linked'],
  attack_type: 'credential_phishing',
  advice: 'Do not click links in this message.'
};
assert.strictEqual(validate('mailDeep', validDeep).ok, true);

// 8. mailDeep schema - invalid attack_type
assert.strictEqual(validate('mailDeep', { ...validDeep, attack_type: 'zero_day_exploit' }).ok, false);

// 9. sitePhish schema - valid
const validSite = {
  level: 'suspicious',
  confidence: 0.7,
  reasons: ['Recent domain registration']
};
assert.strictEqual(validate('sitePhish', validSite).ok, true);

// 10. vulnExplain schema - valid
const validVuln = [
  {
    id: 'csp-missing',
    explanation: 'Absence of CSP permits execution of injected inline scripts.',
    fix: 'Configure Content-Security-Policy HTTP header on server responses.'
  }
];
assert.strictEqual(validate('vulnExplain', validVuln).ok, true);

console.log('PASS: schemas.test.js');

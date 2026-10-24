import assert from 'node:assert';
import { redact, extractDomain, redactObj } from '../../background/redact.js';

console.log('Testing redact.js...');

// 1. Emails
assert.strictEqual(redact('Contact me at alice@example.com'), 'Contact me at [EMAIL]');
assert.strictEqual(redact('user+tag@domain.co.uk is valid'), '[EMAIL] is valid');

// 2. Keep domain option
assert.strictEqual(redact('Contact alice@example.com', { keepDomains: true }), 'Contact [EMAIL]@example.com');
assert.strictEqual(extractDomain('support@secure-bank.org'), 'secure-bank.org');

// 3. Phones
assert.strictEqual(redact('Call +1-555-123-4567 today'), 'Call [PHONE] today');
assert.strictEqual(redact('Direct line: 9876543210'), 'Direct line: [PHONE]');

// 4. Cards
assert.strictEqual(redact('Card 4111 2222 3333 4444 used'), 'Card [CARD] used');
assert.strictEqual(redact('Card 4111222233334444 used'), 'Card [CARD] used');

// 5. Tokens
assert.strictEqual(redact('Secret: abcdefghijklmnopqrstuvwxyz012345'), 'Secret: [TOKEN]');

// 6. OTPs near keywords
assert.strictEqual(redact('Your otp code is 482910'), 'Your otp code is [CODE]');
assert.strictEqual(redact('Enter pin 1234 to proceed'), 'Enter pin [CODE] to proceed');

// 7. Strip query strings
assert.strictEqual(redact('Visit https://site.com/login?token=secret&id=1'), 'Visit https://site.com/login?[QUERY]');

// 8. Recursive redactObj
const obj = {
  email: 'bob@corp.com',
  nested: { phone: '123-456-7890', normal: 'hello' },
  list: ['test@domain.com']
};
const redacted = redactObj(obj);
assert.strictEqual(redacted.email, '[EMAIL]');
assert.strictEqual(redacted.nested.phone, '[PHONE]');
assert.strictEqual(redacted.nested.normal, 'hello');
assert.strictEqual(redacted.list[0], '[EMAIL]');

console.log('PASS: redact.test.js');

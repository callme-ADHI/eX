import test from 'node:test';
import assert from 'node:assert/strict';
import { isMailPage } from '../../src/shared/mail-pages.ts';

test('isMailPage identifies Gmail URLs', () => {
  assert.equal(isMailPage('https://mail.google.com/mail/u/0/#inbox'), true);
  assert.equal(isMailPage('https://inbox.google.com'), true);
  assert.equal(isMailPage('mail.google.com'), true);
});

test('isMailPage identifies other webmail URLs', () => {
  assert.equal(isMailPage('https://outlook.live.com/mail/0/'), true);
  assert.equal(isMailPage('https://outlook.office.com/mail/'), true);
  assert.equal(isMailPage('https://mail.yahoo.com'), true);
  assert.equal(isMailPage('https://mail.proton.me/u/0/inbox'), true);
});

test('isMailPage rejects non-mail URLs', () => {
  assert.equal(isMailPage('https://google.com'), false);
  assert.equal(isMailPage('https://github.com/callme-ADHI/eX'), false);
  assert.equal(isMailPage('https://wikipedia.org'), false);
  assert.equal(isMailPage('http://localhost:3000'), false);
  assert.equal(isMailPage(''), false);
  assert.equal(isMailPage(undefined), false);
});

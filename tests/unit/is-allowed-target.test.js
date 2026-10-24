import assert from 'node:assert';
import { isAllowedTarget } from '../../detectors/vuln-active.js';

console.log('Testing isAllowedTarget()...');

// Allowed targets: localhost, 127.0.0.1, ::1, and RFC1918 private IPs
const allowed = [
  'http://localhost:3000',
  'https://localhost:8080/app',
  'http://127.0.0.1:5000',
  'http://127.0.0.1/',
  'http://[::1]:8000',
  'http://10.0.0.1:8080',
  'http://10.254.1.20',
  'http://172.16.0.1',
  'http://172.31.255.254',
  'http://192.168.1.1',
  'http://192.168.0.100:8080/dashboard',
];

// Disallowed targets: public domains, public IPs, spoofing/tricks
const disallowed = [
  'https://google.com',
  'http://8.8.8.8',
  'https://attacker.com',
  'http://localhost.attacker.com',
  'http://attacker.com/localhost',
  'http://172.15.0.1',     // Below 172.16
  'http://172.32.0.1',     // Above 172.31
  'http://192.169.1.1',    // Not 192.168
  'http://1.1.1.1',
  'not-a-valid-url',
  'ftp://203.0.113.1',
];

for (const url of allowed) {
  assert.strictEqual(isAllowedTarget(url), true, `Should allow target: ${url}`);
}

for (const url of disallowed) {
  assert.strictEqual(isAllowedTarget(url), false, `Should disallow target: ${url}`);
}

console.log(`✓ All ${allowed.length + disallowed.length} target checks passed.`);

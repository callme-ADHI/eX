import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDomain } from '../../src/detectors/psl.ts';
import { determineTier, fetchRealAsn, fetchGoogleDns } from '../../src/detectors/osint-pipeline.ts';
import { computeExScore, canClaimHighTrust } from '../../src/detectors/scoring.ts';

test('PSL correctly parses private domains and assigns registrableDomain', () => {
  const p1 = parseDomain('testsafebrowsing.appspot.com');
  assert.equal(p1.registrableDomain, 'testsafebrowsing.appspot.com');
  assert.equal(p1.suffix, 'appspot.com');
  assert.equal(p1.label, 'testsafebrowsing');
  assert.equal(p1.isSharedHost, true);

  const p2 = parseDomain('user-project.github.io');
  assert.equal(p2.registrableDomain, 'user-project.github.io');
  assert.equal(p2.isSharedHost, true);

  const p3 = parseDomain('api.google.com');
  assert.equal(p3.registrableDomain, 'google.com');
  assert.equal(p3.isSharedHost, false);

  const p4 = parseDomain('news.bbc.co.uk');
  assert.equal(p4.registrableDomain, 'bbc.co.uk');
  assert.equal(p4.isSharedHost, false);
});

test('determineTier assigns T4 to shared host subdomains and never T0', () => {
  const t1 = determineTier('testsafebrowsing.appspot.com');
  assert.equal(t1, 'T4', 'Private suffix subdomain must default to T4');

  const t2 = determineTier('phishing-test.github.io');
  assert.equal(t2, 'T4', 'github.io tenant must default to T4');

  const t3 = determineTier('google.com');
  assert.equal(t3, 'T0', 'Google root must remain T0');
});

test('Coverage shrinkage caps eX Score at 70 when coverage < 30%', () => {
  // Scenario: Clean domain prior, but almost no signals known (confidence = 0.05)
  const res = computeExScore({
    url: 'https://testsafebrowsing.appspot.com/s/content.exe',
    tier: 'T4',
    isSharedHost: true,
    safety: {
      ip_address_host: false,
      punycode_host: false,
    },
    coverage: 0.05,
  });

  assert.ok(res.exScore <= 70, `Score (${res.exScore}) must not exceed 70`);
  assert.equal(res.isLimitedData, true);
  assert.ok(res.confidenceText.includes('Limited data'));
  assert.equal(res.canClaimHighTrust, false);
});

test('Executable URL path flags downloadable_executable_resource finding and caps <= 70', () => {
  const res = computeExScore({
    url: 'https://testsafebrowsing.appspot.com/s/content.exe',
    tier: 'T4',
    isSharedHost: true,
    safety: {
      downloadable_executable_resource: true,
      ip_address_host: false,
    },
    coverage: 0.15,
  });

  assert.ok(res.exScore <= 70, `Score (${res.exScore}) must not exceed 70`);
  assert.ok(
    res.keyFindings.some(f => f.title === 'Downloadable/executable resource'),
    'Must include Downloadable/executable resource finding'
  );
});

test('canClaimHighTrust requires coverage >= 60%, tier T0-T2, and non-shared host', () => {
  // Shared host -> always false
  assert.equal(canClaimHighTrust(0.95, 'T0', true), false);
  // Low coverage -> false
  assert.equal(canClaimHighTrust(0.25, 'T0', false), false);
  // Tier T4 -> false
  assert.equal(canClaimHighTrust(0.95, 'T4', false), false);
  // Eligible authority -> true
  assert.equal(canClaimHighTrust(0.85, 'T0', false), true);
  assert.equal(canClaimHighTrust(0.70, 'T1', false), true);
  assert.equal(canClaimHighTrust(0.65, 'T2', false), true);
});

test('Real ASN resolution for appspot.com resolves to Google AS15169', async () => {
  const dns = await fetchGoogleDns('testsafebrowsing.appspot.com');
  assert.ok(dns.ip, 'Resolved an A record IP for appspot.com');
  const asn = await fetchRealAsn(dns.ip);
  assert.ok(asn, 'ASN resolved');
  assert.ok(asn.includes('15169'), `ASN (${asn}) must contain 15169`);
  assert.ok(!asn.includes('13335'), 'Must never be fake Cloudflare AS13335');
});

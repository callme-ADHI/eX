import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { computeExScore } from '../../src/detectors/scoring.ts';

test('12-profile distribution satisfies eX scoring spread assertions', () => {
  const dir = path.resolve('tests/fixtures/profiles');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  assert.ok(files.length >= 12, 'Must have at least 12 synthetic profiles');

  const results = [];

  for (const f of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
    const res = computeExScore({
      url: `https://${raw.name}.test`,
      tier: raw.tier,
      safety: raw.safety,
      privacy: raw.privacy,
      hardening: raw.hardening,
      coverage: raw.coverage ?? 0.85,
    });
    results.push({ name: raw.name, ...res });
  }

  console.log('\n--- 12 Synthetic Site Profiles Evaluation Table ---');
  console.log('Profile'.padEnd(26), 'Safety'.padEnd(8), 'Privacy'.padEnd(8), 'Hardening'.padEnd(10), 'eX Score'.padEnd(10), 'Grade');
  for (const r of results) {
    console.log(
      r.name.padEnd(26),
      String(r.safety.safetyScore).padEnd(8),
      String(r.privacy.privacyScore).padEnd(8),
      String(r.hardening.hardeningScore).padEnd(10),
      String(r.exScore).padEnd(10),
      r.grade
    );
  }

  const scores = results.map(r => r.exScore);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore;

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  console.log(`\nSpread stats: Min=${minScore}, Max=${maxScore}, Range=${range}, StdDev=${stdDev.toFixed(2)}`);

  // Assertion 1: eX Score range across the set >= 60 points
  assert.ok(range >= 60, `Score range (${range}) must be >= 60`);

  // Assertion 2: std dev > 15
  assert.ok(stdDev > 15, `Standard deviation (${stdDev.toFixed(2)}) must be > 15`);

  // Assertion 3: Unranked static blog with no headers still Safety >= 75
  const blog = results.find(r => r.name.includes('unranked-static-blog'));
  assert.ok(blog, 'Blog profile found');
  assert.ok(blog.safety.safetyScore >= 75, `Blog safety (${blog.safety.safetyScore}) must be >= 75`);

  // Assertion 4: Phishing profile <= 25
  const phish = results.find(r => r.name.includes('brand-lookalike-phish'));
  assert.ok(phish, 'Phish profile found');
  assert.ok(phish.exScore <= 25, `Phish eX Score (${phish.exScore}) must be <= 25`);

  // Assertion 5: Ad-hijack <= 55
  const adHijack = results.find(r => r.name.includes('ad-hijack-streaming'));
  assert.ok(adHijack, 'Ad-hijack profile found');
  assert.ok(adHijack.exScore <= 55, `Ad-hijack eX Score (${adHijack.exScore}) must be <= 55`);

  // Assertion 6: Global portal >= 85, never above 97
  const portal = results.find(r => r.name.includes('global-portal'));
  assert.ok(portal.exScore >= 85 && portal.exScore <= 97);
});

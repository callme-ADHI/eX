import test from "node:test";
import assert from "node:assert/strict";
import { runComprehensiveAssessment } from "../../src/detectors/assessment.ts";

test("runComprehensiveAssessment evaluates 68 parameters across 6 categories", () => {
  const result = runComprehensiveAssessment({
    url: "https://example.com",
    features: {},
    headers: {
      "strict-transport-security": "max-age=31536000",
      "content-security-policy": "default-src \x27self\x27",
    },
  });

  assert.equal(typeof result.overallScore, "number");
  assert.ok(result.overallScore >= 0 && result.overallScore <= 100);
  assert.ok(["A+", "A", "B", "C", "D", "F"].includes(result.grade));

  const totalParams =
    result.categories.identity.totalCount +
    result.categories.transport.totalCount +
    result.categories.hardening.totalCount +
    result.categories.content.totalCount +
    result.categories.privacy.totalCount +
    result.categories.permissions.totalCount;

  assert.equal(totalParams, 68);
});

test("runComprehensiveAssessment penalizes direct IP and HTTP addresses", () => {
  const result = runComprehensiveAssessment({
    url: "http://192.168.1.1/login",
    features: { passwordInputCount: 1 },
  });

  assert.ok(result.overallScore <= 35, "Insecure HTTP or bare IP must receive severe penalty");
  assert.ok(result.grade === "F" || result.grade === "D");
});

test("runComprehensiveAssessment gives high score to reputable HTTPS domains", () => {
  const result = runComprehensiveAssessment({
    url: "https://github.com",
    headers: {
      "strict-transport-security": "max-age=31536000",
      "content-security-policy": "default-src \x27self\x27",
      "x-frame-options": "DENY",
      "x-content-type-options": "nosniff",
    },
    features: {
      passwordInputCount: 0,
      mixedContentCount: 0,
    },
  });

  assert.ok(result.overallScore >= 85);
  assert.ok(["A+", "A"].includes(result.grade));
  assert.equal(result.riskLevel, "LOW");
});

test("runComprehensiveAssessment catches brand spoofing and punycode", () => {
  const result = runComprehensiveAssessment({
    url: "https://xn--pple-43d.com/login",
    features: {
      brandSpoofDetected: true,
      obfuscatedScriptDetected: true,
    },
  });

  assert.ok(result.overallScore <= 25);
  assert.equal(result.riskLevel, "CRITICAL");
});

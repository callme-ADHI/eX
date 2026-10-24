#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { classifyMail } from '../src/content/gmail/mail-classifier-v2.ts';
import { extractJSON } from '../background/json-extract.js';

const corpusDir = path.resolve('tests/mail-corpus');
const files = fs.readdirSync(corpusDir).filter(f => f.endsWith('.json')).sort();

console.log(`Evaluating mail classifier on ${files.length} corpus emails...`);

let TP = 0, FP = 0, TN = 0, FN = 0;
const misclassifications = [];

for (const file of files) {
  const mail = JSON.parse(fs.readFileSync(path.join(corpusDir, file), 'utf-8'));
  const isActualPhish = mail.label === 'phish';

  // Run deterministic classifier
  const res = classifyMail(mail);
  const isPredPhish = res.level === 'high' || res.level === 'suspicious';

  if (isActualPhish && isPredPhish) TP++;
  else if (!isActualPhish && isPredPhish) {
    FP++;
    misclassifications.push({ id: mail.id, actual: 'benign', pred: res.level, pRisk: res.pRisk, reasons: res.topReasons });
  } else if (!isActualPhish && !isPredPhish) TN++;
  else if (isActualPhish && !isPredPhish) {
    FN++;
    misclassifications.push({ id: mail.id, actual: 'phish', pred: res.level, pRisk: res.pRisk, reasons: res.topReasons });
  }
}

const precision = TP / (TP + FP || 1);
const recall = TP / (TP + FN || 1);
const fpr = FP / (FP + TN || 1);

console.log('\n--- CONFUSION MATRIX ---');
console.log(`Actual Phish:  TP = ${TP}  |  FN = ${FN}`);
console.log(`Actual Benign: FP = ${FP}   |  TN = ${TN}`);
console.log(`\nMetrics:`);
console.log(`  Precision: ${(precision * 100).toFixed(1)}%`);
console.log(`  Recall:    ${(recall * 100).toFixed(1)}% (Target: >= 90%)`);
console.log(`  FPR:       ${(fpr * 100).toFixed(1)}% (Target: <= 5%)`);

if (misclassifications.length > 0) {
  console.log(`\nMisclassifications (${misclassifications.length}):`);
  for (const m of misclassifications) {
    console.log(`  - [${m.id}] Actual: ${m.actual}, Pred: ${m.pred} (pRisk: ${m.pRisk})`);
  }
} else {
  console.log('\n✓ Zero misclassifications on synthetic corpus (100% Precision, 100% Recall, 0% FPR).');
}

// Live LLM Pass on 15 emails (10 phish, 5 benign)
console.log('\n--- LIVE LLM PASS ON 15 EMAILS (mailDeep / NVIDIA NIM) ---');
const keysContent = fs.readFileSync(path.resolve('background/keys.js'), 'utf8');
const keyMatch = keysContent.match(/KEY_2:\s*["'](nvapi-[^"']+)["']/);
const apiKey = keyMatch ? keyMatch[1] : null;

const config = JSON.parse(fs.readFileSync(path.resolve('models.config.json'), 'utf8'));
const model = config.mailDeep?.model || 'nvidia/nemotron-3.5-lightning-30b-a3b';

let llmAgreed = 0;
const sampleFiles = [
  ...files.filter(f => f.startsWith('phish-')).slice(0, 10),
  ...files.filter(f => f.startsWith('benign-')).slice(0, 5)
];

if (!apiKey) {
  console.log('Skipping live LLM pass (KEY_2 not found)');
  process.exit(0);
}

for (const sf of sampleFiles) {
  const mail = JSON.parse(fs.readFileSync(path.join(corpusDir, sf), 'utf-8'));
  const prompt = [
    {
      role: 'system',
      content: 'You are an email security classifier. Output a single JSON object without explanation: {"category":"legit_transactional|credential_phishing|delivery_scam|quishing|extortion|malware_delivery","is_phishing":true|false}'
    },
    {
      role: 'user',
      content: JSON.stringify({
        sender: mail.senderAddress,
        name: mail.senderName,
        subject: mail.subject,
        body: (mail.fullBodyText || '').slice(0, 400),
        links: mail.links,
        hasQrCode: mail.hasQrCode
      })
    }
  ];

  try {
    const start = Date.now();
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: prompt,
        temperature: 0.1,
        max_tokens: 1200
      })
    });
    const data = await res.json();
    const elapsed = Date.now() - start;
    const msg = data.choices?.[0]?.message || {};
    const textToSearch = msg.content || msg.reasoning_content || '';
    const catMatch = textToSearch.match(/\{[^{}]*"category"[^{}]*\}/);
    let parsed = {};
    if (catMatch) {
      try { parsed = JSON.parse(catMatch[0]); } catch {}
    }
    if (!parsed.category && typeof extractJSON === 'function') {
      const fallback = extractJSON(textToSearch);
      if (fallback && !Array.isArray(fallback)) parsed = fallback;
    }

    const isPhishPredicted = parsed.is_phishing !== undefined
      ? parsed.is_phishing
      : (parsed.category ? parsed.category !== 'legit_transactional' && parsed.category !== 'legit_marketing' : false);
    const actualPhish = mail.label === 'phish';
    const match = isPhishPredicted === actualPhish;
    if (match) llmAgreed++;
    console.log(`  ${match ? '✓' : '✗'} [${mail.id}] Actual: ${mail.label}, LLM: ${isPhishPredicted ? 'phish' : 'benign'} (${parsed.category || 'unknown'}, ${elapsed}ms)`);
  } catch (err) {
    console.warn(`  ! [${mail.id}] LLM call error:`, err.message);
  }
}

console.log(`\nLive LLM Agreement: ${llmAgreed} / ${sampleFiles.length} (${Math.round(llmAgreed / sampleFiles.length * 100)}%)`);

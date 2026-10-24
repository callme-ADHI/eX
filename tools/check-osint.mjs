#!/usr/bin/env node
import fs from 'node:fs';

const testDomain = 'example.com';
const testIp = '93.184.215.14';

const endpoints = [
  { id: 'rdap', name: 'RDAP Domain Registration', url: `https://rdap.org/domain/${testDomain}`, method: 'GET' },
  { id: 'dns', name: 'Google Public DNS JSON', url: `https://dns.google/resolve?name=${testDomain}&type=A`, method: 'GET' },
  { id: 'crt_sh', name: 'Certificate Transparency (crt.sh)', url: `https://crt.sh/?q=${testDomain}&output=json`, method: 'GET' },
  { id: 'wayback', name: 'Internet Archive Wayback', url: `https://archive.org/wayback/available?url=${testDomain}`, method: 'GET' },
  { id: 'ripestat', name: 'RIPEstat Prefix Overview', url: `https://stat.ripe.net/data/prefix-overview/data.json?resource=${testIp}`, method: 'GET' },
  { id: 'shodan_idb', name: 'Shodan InternetDB', url: `https://internetdb.shodan.io/${testIp}`, method: 'GET' },
  { id: 'alienvault', name: 'AlienVault OTX', url: `https://otx.alienvault.com/api/v1/indicators/domain/${testDomain}/general`, method: 'GET' },
  { id: 'tranco', name: 'Tranco Top 1M Rank API', url: `https://tranco-list.eu/api/ranks/domain/${testDomain}`, method: 'GET' }
];

async function checkEndpoint(ep) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(ep.url, {
      method: ep.method,
      headers: { 'User-Agent': 'eX-Security-Research/2.0' },
      signal: controller.signal
    });
    clearTimeout(timer);
    const latency = Date.now() - start;
    const ok = res.status >= 200 && res.status < 400;
    return { ...ep, status: ok ? 'online' : 'error', httpStatus: res.status, latency };
  } catch (err) {
    return { ...ep, status: 'offline', error: err.message, latency: Date.now() - start };
  }
}

async function run() {
  console.log('Testing OSINT endpoints with harmless domain:', testDomain);
  const results = await Promise.all(endpoints.map(checkEndpoint));

  for (const r of results) {
    const icon = r.status === 'online' ? '✓' : '✗';
    console.log(`  ${icon} [${r.id}] ${r.name}: ${r.status} (${r.latency}ms, status: ${r.httpStatus || r.error})`);
  }

  const out = {
    timestamp: Date.now(),
    testedDomain: testDomain,
    endpoints: results
  };

  fs.writeFileSync('osint-sources.json', JSON.stringify(out, null, 2));
  console.log('Results written to osint-sources.json');
}

run().catch(console.error);

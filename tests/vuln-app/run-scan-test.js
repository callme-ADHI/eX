import assert from 'node:assert';
import http from 'node:http';
import { runLocalActiveScan } from '../../detectors/vuln-active.js';

// Start test server
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/.env') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('SECRET_KEY=planted_vulnerability_12345\n');
    return;
  }
  if (url === '/.git/HEAD') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ref: refs/heads/master\n');
    return;
  }
  if (url === '/robots.txt') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('User-agent: *\nDisallow: /secret\n');
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

const PORT = 38889;
server.listen(PORT, '127.0.0.1', async () => {
  try {
    const findings = await runLocalActiveScan(`http://127.0.0.1:${PORT}`);
    console.log(`Active scan returned ${findings.length} findings:`, findings.map(f => f.title));

    assert.ok(findings.length >= 3, 'Should discover at least 3 findings');
    assert.ok(findings.some(f => f.title.includes('Environment File')), 'Discovered /.env');
    assert.ok(findings.some(f => f.title.includes('Git Repository')), 'Discovered /.git/HEAD');
    assert.ok(findings.some(f => f.title.includes('Robots.txt')), 'Discovered /robots.txt');

    console.log('✓ Active local scan verification passed.');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('Scan test failed:', err);
    server.close();
    process.exit(1);
  }
});

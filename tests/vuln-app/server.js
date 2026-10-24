import http from 'node:http';

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/.env') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('DATABASE_URL=postgres://root:secret@localhost:5432/app\nAWS_SECRET_KEY=AKIAIOSFODNN7EXAMPLE\n');
    return;
  }

  if (url === '/.git/HEAD') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ref: refs/heads/main\n');
    return;
  }

  if (url === '/robots.txt') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('User-agent: *\nDisallow: /admin\nDisallow: /internal\n');
    return;
  }

  if (url === '/api-docs') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ openapi: '3.0.0', info: { title: 'Internal API' } }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<!DOCTYPE html><html><body><h1>Safe Demo App</h1></body></html>');
});

const PORT = 38888;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Vuln test server listening on http://127.0.0.1:${PORT}`);
});

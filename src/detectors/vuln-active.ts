import type { Finding } from './vuln-passive';

export function isAllowedTarget(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
      return true;
    }

    // RFC1918 Private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
    const ipMatch = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipMatch) {
      const b0 = parseInt(ipMatch[1], 10);
      const b1 = parseInt(ipMatch[2], 10);
      if (b0 === 10) return true;
      if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
      if (b0 === 192 && b1 === 168) return true;
    }

    return false;
  } catch (_) {
    return false;
  }
}

const COMMON_PATHS = [
  { path: '/.env', match: /=/, title: 'Exposed Environment File (/.env)', severity: 'high' as const, explanation: 'Critical secrets and environment credentials leaked publicly.', fix: 'Block web access to dotfiles (.env) in server configuration.' },
  { path: '/.git/HEAD', match: /ref:/, title: 'Exposed Git Repository (/.git/HEAD)', severity: 'high' as const, explanation: 'Source code repository files accessible via HTTP.', fix: 'Deny access to /.git directory in web server config.' },
  { path: '/robots.txt', match: /User-agent:/i, title: 'Robots.txt Information Disclosure', severity: 'info' as const, explanation: 'Robots.txt may reveal sensitive administrative or hidden endpoints.', fix: 'Ensure sensitive endpoints are properly secured with authentication, not just hidden in robots.txt.' },
  { path: '/api-docs', match: /swagger|openapi/i, title: 'Exposed API Documentation', severity: 'low' as const, explanation: 'API documentation is exposed without authentication.', fix: 'Restrict API documentation access to authorized developers.' },
  { path: '/server-status', match: /Apache Server Status/i, title: 'Exposed Server Status Page', severity: 'medium' as const, explanation: 'Apache mod_status exposes active queries and client IP addresses.', fix: 'Disable mod_status or restrict access to localhost only.' }
];

export async function runLocalActiveScan(origin: string): Promise<Finding[]> {
  if (!isAllowedTarget(origin)) {
    throw new Error('eX only actively scans your own local apps');
  }

  const findings: Finding[] = [];
  let requestCount = 0;

  for (const probe of COMMON_PATHS) {
    if (requestCount >= 60) break;
    requestCount++;

    try {
      const targetUrl = new URL(probe.path, origin).href;
      const res = await fetch(targetUrl, { method: 'GET' });
      if (res.status === 200) {
        const text = await res.text();
        if (probe.match.test(text)) {
          findings.push({
            id: `active-${probe.path.replace(/[^a-z0-9]/gi, '-')}`,
            title: probe.title,
            severity: probe.severity,
            category: 'exposure',
            evidence: `${probe.path} returned HTTP 200 with signature match`,
            explanation: probe.explanation,
            fix: probe.fix,
            mode: 'active',
            url: targetUrl,
          });
        }
      }
    } catch (_) {}

    await new Promise((r) => setTimeout(r, 60));
  }

  return findings;
}

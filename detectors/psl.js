/**
 * eX — Public Suffix List (PSL) & Private Domain Suffix Parser (Pure JS for Node)
 * detectors/psl.js
 */

export const PRIVATE_DOMAIN_SUFFIXES = [
  'appspot.com',
  'github.io',
  'herokuapp.com',
  'vercel.app',
  'netlify.app',
  'pages.dev',
  'workers.dev',
  'web.app',
  'firebaseapp.com',
  'blogspot.com',
  'azurewebsites.net',
  's3.amazonaws.com',
  'glitch.me',
  'repl.co',
  'replit.dev',
  'replit.app',
  'myshopify.com',
  'gitlab.io',
  'render.com',
  'onrender.com',
  'railway.app',
  'fly.dev',
  'surge.sh',
  'ngrok.io',
  'ngrok-free.app',
  'cloudfront.net',
  'pantheonsite.io',
  'wixsite.com',
  'weebly.com',
  'webflow.io',
  '000webhostapp.com',
];

export const MULTIPART_PUBLIC_SUFFIXES = [
  'co.uk', 'org.uk', 'me.uk', 'ltd.uk', 'plc.uk', 'net.uk', 'sch.uk', 'ac.uk', 'gov.uk',
  'co.in', 'org.in', 'net.in', 'gov.in', 'mil.in', 'ac.in', 'edu.in', 'res.in',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
  'co.nz', 'net.nz', 'org.nz', 'govt.nz',
  'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp',
  'com.br', 'net.br', 'org.br', 'gov.br',
  'co.za', 'org.za', 'gov.za',
  'com.cn', 'net.cn', 'org.cn', 'gov.cn',
  'com.tw', 'org.tw', 'gov.tw',
  'com.hk', 'org.hk', 'gov.hk',
  'com.sg', 'org.sg', 'gov.sg',
  'com.mx', 'org.mx', 'gob.mx',
  'co.kr', 'ne.kr', 'or.kr', 'go.kr',
  'com.tr', 'org.tr', 'gov.tr',
  'com.ru', 'net.ru', 'org.ru',
  'co.id', 'or.id', 'go.id', 'ac.id',
];

export function parseDomain(rawHostname) {
  if (!rawHostname || typeof rawHostname !== 'string') {
    return {
      hostname: 'unknown',
      registrableDomain: 'unknown',
      suffix: '',
      label: 'unknown',
      subdomain: '',
      isSharedHost: false,
      isIp: false,
    };
  }

  let h = rawHostname.toLowerCase().trim();
  h = h.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
  h = h.replace(/\.+$/, '');
  if (h.startsWith('www.')) {
    h = h.slice(4);
  }

  // Check IPv4 or IPv6
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h) || h.startsWith('[')) {
    return {
      hostname: h,
      registrableDomain: h,
      suffix: '',
      label: h,
      subdomain: '',
      isSharedHost: false,
      isIp: true,
    };
  }

  // 1. Check Private Domain Suffixes (appspot.com, github.io, etc.)
  for (const priv of PRIVATE_DOMAIN_SUFFIXES) {
    if (h === priv) {
      return {
        hostname: h,
        registrableDomain: h,
        suffix: priv,
        label: priv.split('.')[0],
        subdomain: '',
        isSharedHost: true,
        isIp: false,
      };
    }
    if (h.endsWith('.' + priv)) {
      const prefix = h.slice(0, -(priv.length + 1));
      const parts = prefix.split('.').filter(Boolean);
      const label = parts[parts.length - 1] || 'unknown';
      const sub = parts.slice(0, -1).join('.');
      const reg = `${label}.${priv}`;
      return {
        hostname: h,
        registrableDomain: reg,
        suffix: priv,
        label,
        subdomain: sub,
        isSharedHost: true,
        isIp: false,
      };
    }
  }

  // 2. Check Multipart Public Suffixes (co.uk, co.in, etc.)
  for (const pub of MULTIPART_PUBLIC_SUFFIXES) {
    if (h === pub) {
      return {
        hostname: h,
        registrableDomain: h,
        suffix: pub,
        label: pub.split('.')[0],
        subdomain: '',
        isSharedHost: false,
        isIp: false,
      };
    }
    if (h.endsWith('.' + pub)) {
      const prefix = h.slice(0, -(pub.length + 1));
      const parts = prefix.split('.').filter(Boolean);
      const label = parts[parts.length - 1] || 'unknown';
      const sub = parts.slice(0, -1).join('.');
      const reg = `${label}.${pub}`;
      return {
        hostname: h,
        registrableDomain: reg,
        suffix: pub,
        label,
        subdomain: sub,
        isSharedHost: false,
        isIp: false,
      };
    }
  }

  // 3. Standard TLD (eTLD+1)
  const parts = h.split('.').filter(Boolean);
  if (parts.length <= 2) {
    const label = parts[0] || h;
    const suffix = parts[1] || '';
    return {
      hostname: h,
      registrableDomain: h,
      suffix,
      label,
      subdomain: '',
      isSharedHost: false,
      isIp: false,
    };
  }

  const suffix = parts[parts.length - 1];
  const label = parts[parts.length - 2];
  const registrableDomain = `${label}.${suffix}`;
  const subdomain = parts.slice(0, -2).join('.');

  return {
    hostname: h,
    registrableDomain,
    suffix,
    label,
    subdomain,
    isSharedHost: false,
    isIp: false,
  };
}

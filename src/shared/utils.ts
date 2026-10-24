export function extractOrigin(url: string): string {
  try { return new URL(url).origin; } catch { return ''; }
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function formatDuration(ms: number): string {
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

export function formatTime(ms: number, mode: '12h' | '24h' = '24h'): string {
  const d = new Date(ms);
  if (mode === '24h') {
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Centralsed tab/domain classification & productivity logic

export const CATEGORY_MAP: Record<string, string> = {
  // Development
  'github.com': 'Development', 'gitlab.com': 'Development', 'stackoverflow.com': 'Development',
  'developer.mozilla.org': 'Development', 'npmjs.com': 'Development', 'codepen.io': 'Development',
  'replit.com': 'Development', 'codesandbox.io': 'Development', 'vercel.com': 'Development',
  // Education
  'classroom.google.com': 'Education', 'coursera.org': 'Education', 'udemy.com': 'Education',
  'khanacademy.org': 'Education', 'wikipedia.org': 'Education', 'leetcode.com': 'Education',
  'hackerrank.com': 'Education', 'mits.etlab.app': 'Education',
  // AI Platforms
  'claude.ai': 'AI', 'chatgpt.com': 'AI', 'gemini.google.com': 'AI', 'grok.com': 'AI',
  'chat.deepseek.com': 'AI', 'kimi.moonshot.cn': 'AI', 'perplexity.ai': 'AI', 'lovable.dev': 'AI',
  // Social Media / Distraction
  'twitter.com': 'Social', 'x.com': 'Social', 'instagram.com': 'Social',
  'facebook.com': 'Social', 'tiktok.com': 'Social', 'reddit.com': 'Social',
  // Entertainment
  'youtube.com': 'Entertainment', 'netflix.com': 'Entertainment', 'twitch.tv': 'Entertainment',
  'spotify.com': 'Entertainment', 'primevideo.com': 'Entertainment',
  // Productivity
  'mail.google.com': 'Productivity', 'docs.google.com': 'Productivity',
  'notion.so': 'Productivity', 'figma.com': 'Productivity', 'linear.app': 'Productivity',
};

const PRODUCTIVE_CATEGORIES = new Set(['Development', 'Education', 'AI', 'Productivity']);
const DISTRACTING_CATEGORIES = new Set(['Social', 'Entertainment']);

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function classifyDomain(domain: string): string {
  if (CATEGORY_MAP[domain]) return CATEGORY_MAP[domain];
  for (const [key, cat] of Object.entries(CATEGORY_MAP)) {
    if (domain.endsWith(key)) return cat;
  }
  return 'Other';
}

export function isProductive(category: string) { return PRODUCTIVE_CATEGORIES.has(category); }
export function isDistracting(category: string) { return DISTRACTING_CATEGORIES.has(category); }

export function classifyTab(
  url: string,
  domain: string,
  title: string,
  description: string,
  ogType: string
): string {
  // 1. Check static map
  const mapped = classifyDomain(domain);
  if (mapped !== 'Other') return mapped;

  const urlLower = url.toLowerCase();
  const titleLower = title.toLowerCase();
  const descLower = description.toLowerCase();
  const domainLower = domain.toLowerCase();

  // 2. Localhost / LAN / Files
  if (
    domainLower === 'localhost' ||
    domainLower === '127.0.0.1' ||
    domainLower.startsWith('192.168.') ||
    domainLower.startsWith('10.') ||
    urlLower.startsWith('file://')
  ) {
    return 'Development';
  }

  // 3. Check for PDF / local files
  if (urlLower.endsWith('.pdf') || urlLower.includes('/pdf/')) {
    return 'Education';
  }

  // 4. Check known distracting apps (e.g. messaging / social / entertainment)
  const distractingKeywords = [
    'telegram.org', 'web.telegram.org', 'whatsapp.com', 'web.whatsapp.com',
    'discord.com', 'slack.com', 'teams.microsoft.com', 'messenger.com',
    'instagram.com', 'facebook.com', 'twitter.com', 'x.com', 'tiktok.com',
    'reddit.com', 'youtube.com', 'netflix.com', 'primevideo.com', 'twitch.tv',
    'spotify.com', 'pinterest.com', 'tumblr.com', 'quora.com'
  ];
  for (const kw of distractingKeywords) {
    if (domainLower.includes(kw)) {
      return 'Social';
    }
  }

  // 5. ogType logic
  if (ogType) {
    if (ogType.startsWith('video') || ogType.includes('movie') || ogType.includes('game')) {
      return 'Entertainment';
    }
    if (ogType === 'article' || ogType === 'book') {
      return 'Education';
    }
  }

  // 6. Keywords in Description or Title
  const productiveKeywords = [
    'study', 'learn', 'education', 'tutorial', 'course', 'document', 'research',
    'development', 'programming', 'coding', 'api docs', 'documentation', 'github',
    'compiler', 'science', 'math', 'academic', 'lecture', 'exercise', 'practice'
  ];
  for (const kw of productiveKeywords) {
    if (descLower.includes(kw) || titleLower.includes(kw)) {
      return 'Education';
    }
  }

  const movieKeywords = ['movie', 'watch online', 'stream', 'game', 'play', 'episodes', 'series'];
  for (const kw of movieKeywords) {
    if (descLower.includes(kw) || titleLower.includes(kw)) {
      return 'Entertainment';
    }
  }

  return 'Other';
}


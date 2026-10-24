/**
 * ~500 trusted registrable domains and brand list.
 * Used by Tier-0 URL and page scoring.
 */

export const TOP_DOMAINS = new Set<string>([
  'google.com','youtube.com','facebook.com','twitter.com','x.com','instagram.com',
  'linkedin.com','microsoft.com','apple.com','amazon.com','netflix.com','github.com',
  'reddit.com','wikipedia.org','openai.com','cloudflare.com','stackoverflow.com',
  'adobe.com','salesforce.com','stripe.com','shopify.com','twilio.com','slack.com',
  'zoom.us','dropbox.com','box.com','atlassian.com','jira.com','confluence.com',
  'notion.so','figma.com','canva.com','trello.com','asana.com','basecamp.com',
  'hubspot.com','mailchimp.com','sendgrid.com','twitch.tv','discord.com','telegram.org',
  'whatsapp.com','snapchat.com','pinterest.com','tumblr.com','wordpress.com','medium.com',
  'substack.com','patreon.com','ko-fi.com','producthunt.com','hacker-news.com',
  'ycombinator.com','techcrunch.com','theverge.com','wired.com','arstechnica.com',
  'cnn.com','bbc.com','nytimes.com','washingtonpost.com','theguardian.com','reuters.com',
  'bloomberg.com','wsj.com','economist.com','forbes.com','businessinsider.com',
  'paypal.com','venmo.com','cashapp.com','wise.com','revolut.com','braintree.com',
  'squareup.com','intuit.com','quickbooks.com','xero.com','freshbooks.com',
  'chase.com','bankofamerica.com','wellsfargo.com','citibank.com','usbank.com',
  'barclays.com','hsbc.com','lloydsbank.com','santander.com','ing.com',
  'ebay.com','etsy.com','aliexpress.com','walmart.com','target.com','bestbuy.com',
  'costco.com','newegg.com','bhphotovideo.com','adorama.com','wayfair.com','overstock.com',
  'godaddy.com','namecheap.com','bluehost.com','siteground.com','hostinger.com',
  'digitalocean.com','linode.com','vultr.com','heroku.com','vercel.com','netlify.com',
  'render.com','railway.app','fly.io','aws.amazon.com','azure.microsoft.com',
  'cloud.google.com','firebase.google.com','supabase.com','planetscale.com',
  'mongodb.com','postgresql.org','mysql.com','redis.io','elasticsearch.com',
  'docker.com','kubernetes.io','terraform.io','ansible.com','jenkins.io',
  'git-scm.com','bitbucket.org','gitlab.com','npmjs.com','pypi.org','rubygems.org',
  'packagist.org','cargo.io','nuget.org','maven.apache.org','gradle.org',
  'jetbrains.com','visualstudio.com','code.visualstudio.com','sublime.wbond.net',
  'atom.io','vim.org','emacs.org','neovim.io','eclipse.org','netbeans.apache.org',
  'mozilla.org','firefox.com','chrome.google.com','opera.com','brave.com','vivaldi.com',
  'duckduckgo.com','bing.com','yahoo.com','ask.com','baidu.com','yandex.com',
  'coursera.org','udemy.com','edx.org','khanacademy.org','codecademy.com',
  'pluralsight.com','udacity.com','skillshare.com','leetcode.com','hackerrank.com',
  'codewars.com','exercism.io','replit.com','codesandbox.io','codepen.io','jsfiddle.net',
  'stackblitz.com','iana.org','icann.org','ietf.org','w3.org','w3schools.com','mdn.mozilla.org',
  'reactjs.org','vuejs.org','angular.io','svelte.dev','nextjs.org','nuxtjs.org',
  'nodejs.org','deno.land','bun.sh','rust-lang.org','golang.org','kotlinlang.org',
  'swift.org','java.com','python.org','php.net','ruby-lang.org','perl.org',
  'scala-lang.org','haskell.org','elixir-lang.org','erlang.org','clojure.org',
  'steam.com','steampowered.com','epicgames.com','gog.com','ea.com','ubisoft.com',
  'blizzard.com','playstation.com','xbox.com','nintendo.com','roblox.com',
]);

export interface BrandEntry {
  brand: string;
  domains: string[];
}

export const BRANDS: BrandEntry[] = [
  { brand: 'google', domains: ['google.com', 'accounts.google.com', 'myaccount.google.com'] },
  { brand: 'microsoft', domains: ['microsoft.com', 'login.microsoftonline.com', 'live.com', 'outlook.com', 'office.com'] },
  { brand: 'apple', domains: ['apple.com', 'appleid.apple.com', 'icloud.com'] },
  { brand: 'amazon', domains: ['amazon.com', 'sellercentral.amazon.com', 'aws.amazon.com'] },
  { brand: 'paypal', domains: ['paypal.com'] },
  { brand: 'chase', domains: ['chase.com'] },
  { brand: 'bankofamerica', domains: ['bankofamerica.com'] },
  { brand: 'wellsfargo', domains: ['wellsfargo.com'] },
  { brand: 'citibank', domains: ['citibank.com', 'citi.com'] },
  { brand: 'netflix', domains: ['netflix.com'] },
  { brand: 'facebook', domains: ['facebook.com', 'meta.com'] },
  { brand: 'instagram', domains: ['instagram.com'] },
  { brand: 'linkedin', domains: ['linkedin.com'] },
  { brand: 'dropbox', domains: ['dropbox.com'] },
  { brand: 'docusign', domains: ['docusign.com'] },
  { brand: 'adobe', domains: ['adobe.com'] },
  { brand: 'stripe', domains: ['stripe.com'] },
  { brand: 'coinbase', domains: ['coinbase.com'] },
  { brand: 'binance', domains: ['binance.com'] },
  { brand: 'irs', domains: ['irs.gov'] },
  { brand: 'usps', domains: ['usps.com'] },
  { brand: 'fedex', domains: ['fedex.com'] },
  { brand: 'ups', domains: ['ups.com'] },
  { brand: 'dhl', domains: ['dhl.com'] },
  { brand: 'intuit', domains: ['intuit.com','quickbooks.com','turbotax.com'] },
  { brand: 'salesforce', domains: ['salesforce.com'] },
  { brand: 'atlassian', domains: ['atlassian.com','jira.com'] },
  { brand: 'hubspot', domains: ['hubspot.com'] },
  { brand: 'gitlab', domains: ['gitlab.com'] },
  { brand: 'github', domains: ['github.com'] },
];

export function isTrustedDomain(domain: string): boolean {
  return TOP_DOMAINS.has(domain);
}

export function findBrand(keyword: string): BrandEntry | null {
  const kw = keyword.toLowerCase();
  return BRANDS.find((b) => b.brand === kw || b.brand.includes(kw) || kw.includes(b.brand)) || null;
}

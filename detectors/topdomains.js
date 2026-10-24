/**
 * ~500 trusted registrable domains and brand list.
 * Used by Tier-0 URL and page scoring.
 * SPEC Section 6.2, detectors/topdomains.js.
 */

/** Set of trusted registrable domains (no subdomain, no protocol). */
export const TOP_DOMAINS = new Set([
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
  'pluralsight.com','udacity.com','skillshare.com','linkedin.com','udemy.com',
  'leetcode.com','hackerrank.com','codewars.com','exercism.io','replit.com',
  'codesandbox.io','codepen.io','jsfiddle.net','glitch.com','stackblitz.com',
  'iana.org','icann.org','ietf.org','w3.org','w3schools.com','mdn.mozilla.org',
  'docs.microsoft.com','docs.python.org','developer.apple.com','developer.android.com',
  'reactjs.org','vuejs.org','angular.io','svelte.dev','nextjs.org','nuxtjs.org',
  'nodejs.org','deno.land','bun.sh','rust-lang.org','golang.org','kotlinlang.org',
  'swift.org','java.com','python.org','php.net','ruby-lang.org','perl.org',
  'scala-lang.org','haskell.org','elixir-lang.org','erlang.org','clojure.org',
  'ocaml.org','fsharp.org','dotnet.microsoft.com','unity.com','unrealengine.com',
  'gamedev.net','itch.io','steam.com','steampowered.com','epicgames.com','gog.com',
  'spotify.com','apple.com','soundcloud.com','bandcamp.com','mixcloud.com',
  'pandora.com','tidal.com','deezer.com','lastfm.com','genius.com',
  'imdb.com','rottentomatoes.com','metacritic.com','gamespot.com','ign.com',
  'marvel.com','dc.com','pixar.com','disneyplus.com','hulu.com','hbomax.com',
  'primevideo.com','peacocktv.com','paramountplus.com','appletv.apple.com',
  'zoom.us','teams.microsoft.com','webex.com','gotomeeting.com','skype.com',
  'meet.google.com','whereby.com','jitsi.org','bigbluebutton.org',
  'zapier.com','make.com','n8n.io','ifttt.com','automate.io',
  'airtable.com','monday.com','clickup.com','smartsheet.com','wrike.com',
  'todoist.com','any.do','omnifocus.com','things.app','ticktick.com',
  'evernote.com','onenote.com','bear.app','obsidian.md','roamresearch.com',
  'miro.com','mural.co','lucidchart.com','draw.io','whimsical.com',
  'loom.com','screencastify.com','camtasia.com','obs.ninja','streamlabs.com',
  'bit.dev','snyk.io','veracode.com','checkmarx.com','sonarqube.org',
  'nessus.tenable.com','qualys.com','rapid7.com','crowdstrike.com','sentinelone.com',
  'malwarebytes.com','avast.com','avg.com','kaspersky.com','norton.com','mcafee.com',
  'eset.com','bitdefender.com','sophos.com','trendmicro.com','cylance.com',
  'paloaltonetworks.com','cisco.com','fortinet.com','juniper.net','f5.com',
  'cloudflare.com','akamai.com','fastly.com','incapsula.com','sucuri.net',
  'let-encrypt.org','ssl.com','digicert.com','sectigo.com','globalsign.com',
  'twilio.com','vonage.com','bandwidth.com','plivo.com','nexmo.com',
  'sendgrid.com','mailgun.com','ses.amazonaws.com','postmarkapp.com','sparkpost.com',
  'gravatar.com','disqus.com','livechat.com','intercom.com','zendesk.com',
  'freshdesk.com','helpscout.com','drift.com','crisp.chat','tawk.to',
  'google.co.uk','google.co.in','google.de','google.fr','google.es','google.it',
  'amazon.co.uk','amazon.de','amazon.fr','amazon.it','amazon.co.jp','amazon.in',
  'ebay.co.uk','ebay.de','ebay.fr','ebay.it','ebay.com.au',
  'microsoft.com','office.com','office365.com','live.com','hotmail.com','outlook.com',
  'apple.com','icloud.com','me.com','mac.com',
  'google.com','gmail.com','googlemail.com','drive.google.com','docs.google.com',
  'maps.google.com','photos.google.com','calendar.google.com','accounts.google.com',
]);

/**
 * Brand entries: { brand, domains[] }
 * Used for lookalike / brand-impersonation detection.
 */
export const BRANDS = [
  { brand: 'paypal', domains: ['paypal.com'] },
  { brand: 'amazon', domains: ['amazon.com','amazon.co.uk','amazon.de','amazon.fr','amazon.in'] },
  { brand: 'apple', domains: ['apple.com','icloud.com'] },
  { brand: 'microsoft', domains: ['microsoft.com','live.com','outlook.com','office.com','microsoftonline.com'] },
  { brand: 'google', domains: ['google.com','gmail.com','accounts.google.com'] },
  { brand: 'facebook', domains: ['facebook.com','fb.com'] },
  { brand: 'netflix', domains: ['netflix.com'] },
  { brand: 'chase', domains: ['chase.com'] },
  { brand: 'bankofamerica', domains: ['bankofamerica.com'] },
  { brand: 'wellsfargo', domains: ['wellsfargo.com'] },
  { brand: 'citibank', domains: ['citibank.com','citi.com'] },
  { brand: 'usps', domains: ['usps.com'] },
  { brand: 'fedex', domains: ['fedex.com'] },
  { brand: 'ups', domains: ['ups.com'] },
  { brand: 'dhl', domains: ['dhl.com'] },
  { brand: 'irs', domains: ['irs.gov'] },
  { brand: 'dropbox', domains: ['dropbox.com'] },
  { brand: 'linkedin', domains: ['linkedin.com'] },
  { brand: 'twitter', domains: ['twitter.com','x.com'] },
  { brand: 'instagram', domains: ['instagram.com'] },
  { brand: 'youtube', domains: ['youtube.com'] },
  { brand: 'ebay', domains: ['ebay.com'] },
  { brand: 'walmart', domains: ['walmart.com'] },
  { brand: 'adobe', domains: ['adobe.com'] },
  { brand: 'steam', domains: ['steampowered.com','store.steampowered.com'] },
  { brand: 'discord', domains: ['discord.com','discord.gg'] },
  { brand: 'coinbase', domains: ['coinbase.com'] },
  { brand: 'binance', domains: ['binance.com'] },
  { brand: 'kraken', domains: ['kraken.com'] },
  { brand: 'stripe', domains: ['stripe.com'] },
  { brand: 'shopify', domains: ['shopify.com'] },
  { brand: 'github', domains: ['github.com'] },
  { brand: 'gitlab', domains: ['gitlab.com'] },
  { brand: 'slack', domains: ['slack.com'] },
  { brand: 'zoom', domains: ['zoom.us'] },
  { brand: 'docusign', domains: ['docusign.com'] },
  { brand: 'intuit', domains: ['intuit.com','quickbooks.com','turbotax.com'] },
  { brand: 'salesforce', domains: ['salesforce.com'] },
  { brand: 'atlassian', domains: ['atlassian.com','jira.com'] },
  { brand: 'hubspot', domains: ['hubspot.com'] },
];

/**
 * Check if a registrable domain is in the top-domains list.
 * @param {string} domain - e.g. "google.com"
 * @returns {boolean}
 */
export function isTrustedDomain(domain) {
  return TOP_DOMAINS.has(domain);
}

/**
 * Find brand entry matching a brand name keyword.
 * @param {string} keyword
 * @returns {{brand:string, domains:string[]}|null}
 */
export function findBrand(keyword) {
  const kw = keyword.toLowerCase();
  return BRANDS.find((b) => b.brand === kw || b.brand.includes(kw) || kw.includes(b.brand)) || null;
}

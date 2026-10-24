/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  eX — Bundled Ad & Popunder Networks (>= 60)
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const AD_NETWORKS: Set<string> = new Set([
  "propellerads.com",
  "popcash.net",
  "popads.net",
  "adcash.com",
  "hilltopads.com",
  "clickadu.com",
  "trafficjunky.com",
  "exoclick.com",
  "ero-advertising.com",
  "trafficstars.com",
  "zeropark.com",
  "richpush.co",
  "evadav.com",
  "monetag.com",
  "rollerads.com",
  "admaven.com",
  "yllix.com",
  "bidvertiser.com",
  "infolinks.com",
  "chitika.com",
  "mgid.com",
  "revcontent.com",
  "taboola.com",
  "outbrain.com",
  "zergnet.com",
  "adsterra.com",
  "clickorlando.com",
  "trafficfactory.biz",
  "plugrush.com",
  "juicyads.com",
  "adcolony.com",
  "applovin.com",
  "unityads.unity3d.com",
  "chartboost.com",
  "vungle.com",
  "ironsrc.com",
  "fyber.com",
  "inmobi.com",
  "mintegral.com",
  "smaato.com",
  "smartadserver.com",
  "sovrn.com",
  "pubmatic.com",
  "rubiconproject.com",
  "openx.net",
  "criteo.com",
  "magnite.com",
  "sharethrough.com",
  "yieldmo.com",
  "triplelift.com",
  "gumgum.com",
  "kargo.com",
  "undertone.com",
  "conversantmedia.com",
  "exponential.com",
  "adblade.com",
  "adcovery.com",
  "adkeeper.com",
  "adknowledge.com",
  "admedia.com",
  "adpushup.com",
  "adrecover.com",
  "adsupply.com",
  "advally.com",
  "adventori.com"
]);
export function isAdNetwork(hostname: string): boolean {
  const clean = hostname.toLowerCase().replace(/^www\./, "");
  if (AD_NETWORKS.has(clean)) return true;
  for (const a of AD_NETWORKS) {
    if (clean === a || clean.endsWith("." + a)) return true;
  }
  return false;
}

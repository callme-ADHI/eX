/**
 * eX — Global & India Verified Brands (>= 60)
 */
export interface BrandDefinition {
  name: string;
  domains: string[];
}
export const VERIFIED_BRANDS: BrandDefinition[] = [
  { name: "Google", domains: ["google.com","google.co.in","youtube.com","gmail.com"] },
  { name: "Microsoft", domains: ["microsoft.com","live.com","outlook.com","office.com"] },
  { name: "Apple", domains: ["apple.com","icloud.com"] },
  { name: "Amazon", domains: ["amazon.com","amazon.in","aws.amazon.com"] },
  { name: "Meta", domains: ["meta.com","facebook.com","instagram.com","whatsapp.com"] },
  { name: "PayPal", domains: ["paypal.com","paypal.me"] },
  { name: "Netflix", domains: ["netflix.com"] },
  { name: "LinkedIn", domains: ["linkedin.com"] },
  { name: "Twitter", domains: ["twitter.com","x.com"] },
  { name: "Dropbox", domains: ["dropbox.com"] },
  { name: "Adobe", domains: ["adobe.com"] },
  { name: "Zoom", domains: ["zoom.us","zoom.com"] },
  { name: "DocuSign", domains: ["docusign.com","docusign.net"] },
  { name: "GitHub", domains: ["github.com"] },
  { name: "Coinbase", domains: ["coinbase.com"] },
  { name: "Binance", domains: ["binance.com"] },
  { name: "DHL", domains: ["dhl.com","dhl.de"] },
  { name: "FedEx", domains: ["fedex.com"] },
  { name: "UPS", domains: ["ups.com"] },
  { name: "State Bank of India", domains: ["sbi.co.in","onlinesbi.sbi","sbi.bank"] },
  { name: "HDFC Bank", domains: ["hdfcbank.com","hdfcbank.net","hdfc.com"] },
  { name: "ICICI Bank", domains: ["icicibank.com"] },
  { name: "Axis Bank", domains: ["axisbank.com"] },
  { name: "Kotak Mahindra Bank", domains: ["kotak.com"] },
  { name: "Punjab National Bank", domains: ["pnbindia.in"] },
  { name: "Bank of Baroda", domains: ["bankofbaroda.in"] },
  { name: "Canara Bank", domains: ["canarabank.com"] },
  { name: "Union Bank of India", domains: ["unionbankofindia.co.in"] },
  { name: "Paytm", domains: ["paytm.com","paytmbank.com"] },
  { name: "PhonePe", domains: ["phonepe.com"] },
  { name: "Google Pay", domains: ["pay.google.com"] },
  { name: "NPCI / UPI", domains: ["npci.org.in","upi.org.in"] },
  { name: "UIDAI / Aadhaar", domains: ["uidai.gov.in"] },
  { name: "Income Tax India", domains: ["incometax.gov.in","tin-nsdl.com"] },
  { name: "EPFO", domains: ["epfindia.gov.in"] },
  { name: "India Post", domains: ["indiapost.gov.in","ippbonline.com"] },
  { name: "IRCTC", domains: ["irctc.co.in"] },
  { name: "Flipkart", domains: ["flipkart.com"] },
  { name: "Jio", domains: ["jio.com"] },
  { name: "Airtel", domains: ["airtel.in","airtel.com"] },
  { name: "Vi / Vodafone Idea", domains: ["myvi.in"] },
  { name: "KSEB", domains: ["kseb.in"] },
  { name: "Kerala Police", domains: ["keralapolice.gov.in"] },
  { name: "Swiggy", domains: ["swiggy.com"] },
  { name: "Zomato", domains: ["zomato.com"] },
  { name: "Ola", domains: ["olacabs.com"] },
  { name: "Uber", domains: ["uber.com"] },
  { name: "Tata", domains: ["tata.com","tatadigital.com","tcs.com"] },
  { name: "Razorpay", domains: ["razorpay.com"] },
  { name: "Cred", domains: ["cred.club"] },
  { name: "Zerodha", domains: ["zerodha.com"] },
  { name: "Groww", domains: ["groww.in"] },
  { name: "AngelOne", domains: ["angelone.in"] },
  { name: "Upstox", domains: ["upstox.com"] },
  { name: "NSE India", domains: ["nseindia.com"] },
  { name: "BSE India", domains: ["bseindia.com"] },
  { name: "SEBI", domains: ["sebi.gov.in"] },
  { name: "RBI", domains: ["rbi.org.in"] },
  { name: "Spotify", domains: ["spotify.com"] },
  { name: "Telegram", domains: ["telegram.org","t.me"] },
];

export function findBrandByDomain(domain: string): BrandDefinition | undefined {
  const d = domain.toLowerCase().replace(/^www\./, "");
  return VERIFIED_BRANDS.find(b => b.domains.some(legit => d === legit || d.endsWith("." + legit)));
}

export function findBrandByName(name: string): BrandDefinition | undefined {
  const n = name.toLowerCase();
  return VERIFIED_BRANDS.find(b => {
    const bn = b.name.toLowerCase();
    return bn === n || n.includes(bn);
  });
}

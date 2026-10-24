# Gmail Test Mail Suite (6 Phishing + 4 Normal)

## Phishing Samples

### 1. PayPal Display Name Spoofing
- **From:** "PayPal Security" <alerts-notice@cheapbilling-server.xyz>
- **Subject:** URGENT: Your account has been temporarily locked
- **Snippet:** We detected unauthorized sign-ins. Confirm your identity within 24 hours.
- **Why Flagged:** Display name claims PayPal, but sender domain is cheapbilling-server.xyz; urgent alarm language.

### 2. Fake Google Security Alert
- **From:** "Google Account Team" <security-team@g00gle-verify.com>
- **Subject:** Critical security alert: Password reset requested
- **Snippet:** Someone attempted to sign in to your Google Account from Moscow, Russia.
- **Why Flagged:** Typosquatted domain (g00gle-verify.com); urgency.

### 3. CEO Fraud / Wire Transfer BEC
- **From:** "Sarah Connor, CEO" <sarah.connor.ceo@gmail.com>
- **Subject:** Confidential: Urgent wire transfer needed today
- **Snippet:** Please process this vendor wire transfer immediately before end of business.
- **Why Flagged:** Free-mail address (@gmail.com) impersonating executive; urgency and financial request.

### 4. Malicious Invoice Attachment
- **From:** "Billing Department" <accounting@vendor-fastpay.net>
- **Subject:** Invoice #98421 Past Due Notice
- **Snippet:** Please find your past due invoice attached. Remit payment today.
- **Attachment:** Invoice_PastDue_98421.pdf.exe
- **Why Flagged:** High-risk double extension (.pdf.exe) and generic invoice subject.

### 5. Bank Credential Harvesting with Mismatched Link
- **From:** "Chase Online Services" <service@chase.com>
- **Subject:** Action Required: Update your contact preferences
- **Snippet:** Click here to review your preferences.
- **Body / Link:** Text reads "https://chase.com/secure-login", but hyperlink points to "http://198.51.100.4/chase-steal/".
- **Why Flagged:** Link text destination mismatch.

### 6. Tax Refund / Prize Scam
- **From:** "IRS Internal Revenue Service" <refund-portal@irs-tax-refund.org>
- **Subject:** CONGRATULATIONS: TAX REFUND WINNER OF $1,420
- **Snippet:** Claim your tax refund now by submitting your SSN and debit card details.
- **Why Flagged:** Excessive uppercase; government impersonation; credential & card solicitation.

---

## Normal Samples

### 7. GitHub Pull Request Notification
- **From:** "GitHub" <notifications@github.com>
- **Subject:** [torvalds/linux] Pull Request #140: Fix memory leak in driver
- **Snippet:** torvalds merged 1 commit into master from fix-leak branch.
- **Status:** Safe. Legitimate domain, no spoofing.

### 8. Regular Team Meeting Invite
- **From:** "David Miller" <david.miller@company.org>
- **Subject:** Sprint 42 Planning Meeting
- **Snippet:** Hi all, let's meet tomorrow at 10 AM to review sprint objectives.
- **Status:** Safe. Personal colleague email, standard text.

### 9. Amazon Order Confirmation
- **From:** "Amazon.com" <auto-confirm@amazon.com>
- **Subject:** Your Amazon.com order of "USB-C Hub" has shipped
- **Snippet:** Track your package: arriving by Thursday 8 PM.
- **Status:** Safe. Authenticated sender domain matches Amazon brand.

### 10. Weekly Newsletter
- **From:** "The Pragmatic Engineer" <newsletter@pragmaticengineer.com>
- **Subject:** Issue #92: Building resilient frontend architectures
- **Snippet:** Here is this week's deep dive into distributed systems and engineering management.
- **Status:** Safe. Standard informational newsletter.

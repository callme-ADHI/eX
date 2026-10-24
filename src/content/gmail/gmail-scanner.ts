export interface GmailRow {
  rowId: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  hasAttachment: boolean;
}

export interface OpenedEmail {
  subject: string;
  senderName: string;
  senderEmail: string;
  replyTo?: string;
  bodyText: string;
  links: { text: string; hrefHost: string }[];
  attachments: { name: string }[];
}

export function scanInboxRows(): GmailRow[] {
  if (window.location.hostname !== 'mail.google.com') return [];

  // Gmail inbox rows typically match tr.zA or div[role="row"]
  const rows = Array.from(document.querySelectorAll('tr.zA, div[role="row"]'));
  const results: GmailRow[] = [];

  for (let i = 0; i < Math.min(50, rows.length); i++) {
    const el = rows[i] as HTMLElement;
    const senderEl = el.querySelector('span[email], span.bA4 span, .yX span');
    const senderName = senderEl?.textContent?.trim() || 'Unknown';
    const senderEmail = senderEl?.getAttribute('email') || '';

    const subjectEl = el.querySelector('span.bog, .y6 span');
    const subject = subjectEl?.textContent?.trim() || '';

    const snippetEl = el.querySelector('span.y2');
    const snippet = snippetEl?.textContent?.replace(/^[\s\-–—]+/, '').trim() || '';

    const hasAttachment = Boolean(el.querySelector('.brc, [aria-label*="attachment" i]'));

    const rowId = `row_${i}_${senderEmail || senderName}_${subject.slice(0, 20)}`.replace(/[^a-zA-Z0-9_]/g, '');

    results.push({
      rowId,
      senderName,
      senderEmail,
      subject,
      snippet,
      hasAttachment,
    });
  }

  return results;
}

export function scanOpenedEmail(): OpenedEmail | null {
  if (window.location.hostname !== 'mail.google.com') return null;

  const subjectEl = document.querySelector('h2.hP, div.ha h2');
  const subject = subjectEl?.textContent?.trim() || '';
  if (!subject) return null; // No opened email found

  const senderEl = document.querySelector('span.gD, span[email]');
  const senderName = senderEl?.getAttribute('name') || senderEl?.textContent?.trim() || '';
  const senderEmail = senderEl?.getAttribute('email') || '';

  const replyToEl = document.querySelector('span.go');
  const replyTo = replyToEl?.getAttribute('email') || replyToEl?.textContent?.trim() || undefined;

  const bodyEl = document.querySelector('div.a3s, div.ii.gt');
  const bodyText = (bodyEl?.textContent || '').slice(0, 3000).trim();

  const links: { text: string; hrefHost: string }[] = [];
  if (bodyEl) {
    const aTags = Array.from(bodyEl.querySelectorAll('a'));
    for (const a of aTags) {
      if (a.href && !a.href.startsWith('mailto:')) {
        try {
          const u = new URL(a.href);
          links.push({
            text: (a.textContent || '').trim().slice(0, 80),
            hrefHost: u.hostname,
          });
        } catch (_) {}
      }
    }
  }

  const attachments: { name: string }[] = [];
  const attEls = Array.from(document.querySelectorAll('.aZo, [download_url]'));
  for (const att of attEls) {
    const name = att.textContent?.trim() || att.getAttribute('download_url') || 'attachment';
    attachments.push({ name });
  }

  return {
    subject,
    senderName,
    senderEmail,
    replyTo,
    bodyText,
    links: links.slice(0, 15),
    attachments: attachments.slice(0, 10),
  };
}

export function startGmailObserver(
  onInboxChanged: (rows: GmailRow[]) => void,
  onEmailOpened: (mail: OpenedEmail) => void
) {
  if (window.location.hostname !== 'mail.google.com') return;

  let lastScannedRowsCount = 0;
  let lastOpenedSubject = '';

  const check = () => {
    // Check opened email first
    const opened = scanOpenedEmail();
    if (opened && opened.subject && opened.subject !== lastOpenedSubject) {
      lastOpenedSubject = opened.subject;
      onEmailOpened(opened);
    }

    // Check inbox rows
    const rows = scanInboxRows();
    if (rows.length > 0 && Math.abs(rows.length - lastScannedRowsCount) > 2) {
      lastScannedRowsCount = rows.length;
      onInboxChanged(rows);
    }
  };

  // Run initial check
  setTimeout(check, 1500);

  // Observe DOM changes in Gmail
  const observer = new MutationObserver(() => {
    check();
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * Email preview — renders the templated email body that the couple
 * receives, inside a sandboxed iframe so its inline styles + email-
 * client-friendly tables don't bleed into the modal.
 *
 * Renders an envelope around the iframe with `From:`, `To:`, and
 * `Subject:` rows so the MC can see the full email context, not just
 * the body.
 *
 * @module components/builders/parts/preview-email
 */
'use client';

import { useMemo } from 'react';

import { contractHtml, invoiceHtml } from '@/lib/email/html';

import type { PreviewDoc } from './preview-shared';

export interface PreviewEmailProps {
  doc: PreviewDoc;
  coupleEmail?: string | null | undefined;
}

function buildSubject(doc: PreviewDoc): string {
  if (doc.kind === 'contract') {
    return `Contract ${doc.documentNumber} from ${doc.businessName ?? 'your MC'}`;
  }
  return `Invoice ${doc.documentNumber} from ${doc.businessName ?? 'your MC'}`;
}

function formatDueDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Placeholder shown in place of the share URL while the document has no
 * share token yet (an unsaved draft). Kept plain-language so nothing in
 * the preview looks like a URL the MC could copy.
 */
const PENDING_LINK_TEXT = 'link created when you send';

/**
 * Adapt an email template for preview inside a sandboxed iframe.
 *
 * Two adjustments, both preview-only — the emails couples actually
 * receive are untouched:
 *
 * - `<base target="_blank">` so the CTA opens the invoice in a new tab
 *   instead of navigating the preview iframe itself (which the sandbox
 *   then blocks, so the MC just saw a "refused to connect" panel).
 * - When there is no share link yet, every `href` is stripped so the
 *   button and copy-link line are inert rather than pointing at a URL
 *   that does not resolve.
 *
 * @param html      Rendered email HTML from the shared templates.
 * @param shareUrl  The document's public link, or null when unsaved.
 * @returns         HTML ready to hand to the iframe's `srcDoc`.
 */
export function decorateEmailPreview(html: string, shareUrl: string | null): string {
  const withBase = html.includes('<head>')
    ? html.replace('<head>', '<head><base target="_blank">')
    : `<base target="_blank">${html}`;
  if (shareUrl) return withBase;
  return withBase.replace(/\s*href="[^"]*"/g, '');
}

export function PreviewEmail({ doc, coupleEmail }: PreviewEmailProps) {
  const html = useMemo(() => {
    // An unsaved document has no share token, so the templates get a
    // human-readable stand-in and `decorateEmailPreview` removes the
    // hrefs that would otherwise wrap it.
    const shareUrl = doc.shareUrl ?? PENDING_LINK_TEXT;
    const rendered =
      doc.kind === 'contract'
        ? contractHtml({
            coupleName: doc.coupleName ?? 'there',
            contractNumber: doc.documentNumber,
            contractTitle: doc.title || `Contract ${doc.documentNumber}`,
            expiresAt: formatDueDate(doc.expiresAt),
            shareUrl,
            mcBusinessName: doc.businessName ?? 'Your MC',
          })
        : invoiceHtml({
            coupleName: doc.coupleName ?? 'there',
            invoiceNumber: doc.documentNumber,
            invoiceTitle: doc.title || `Invoice ${doc.documentNumber}`,
            dueDate: formatDueDate(doc.dueDate),
            shareUrl,
            mcBusinessName: doc.businessName ?? 'Your MC',
          });
    return decorateEmailPreview(rendered, doc.shareUrl);
  }, [doc]);

  const subject = buildSubject(doc);
  const fromAddress = doc.businessName ? `${doc.businessName} via Zebri` : 'Zebri';

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="space-y-1 rounded-control border border-border bg-surface px-4 py-3 text-body text-text-muted">
        <div>
          <span className="font-medium text-text">From</span> · {fromAddress}
        </div>
        <div>
          <span className="font-medium text-text">To</span> ·{' '}
          {coupleEmail ?? (
            <span className="italic text-text-subtle">no email on couple — add one to send</span>
          )}
        </div>
        <div>
          <span className="font-medium text-text">Subject</span> · {subject}
        </div>
      </div>
      {/* allow-popups (+ escape-sandbox) is what lets the CTA open the
          real invoice in a new tab; scripts stay disabled. */}
      <iframe
        srcDoc={html}
        title="Email preview"
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        className="flex-1 rounded-control border border-border bg-surface"
      />
    </div>
  );
}

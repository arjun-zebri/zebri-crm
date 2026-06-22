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

import { contractHtml, invoiceHtml, quoteHtml } from '@/lib/email/html';

import type { PreviewDoc } from './preview-shared';

export interface PreviewEmailProps {
  doc: PreviewDoc;
  coupleEmail?: string | null | undefined;
}

function buildSubject(doc: PreviewDoc): string {
  if (doc.kind === 'quote') {
    return `Quote ${doc.documentNumber} from ${doc.businessName ?? 'your MC'}`;
  }
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

export function PreviewEmail({ doc, coupleEmail }: PreviewEmailProps) {
  const html = useMemo(() => {
    if (doc.kind === 'quote') {
      return quoteHtml({
        coupleName: doc.coupleName ?? 'there',
        quoteNumber: doc.documentNumber,
        quoteTitle: doc.title || `Quote ${doc.documentNumber}`,
        shareUrl: doc.shareUrl,
        mcBusinessName: doc.businessName ?? 'Your MC',
      });
    }
    if (doc.kind === 'contract') {
      return contractHtml({
        coupleName: doc.coupleName ?? 'there',
        contractNumber: doc.documentNumber,
        contractTitle: doc.title || `Contract ${doc.documentNumber}`,
        expiresAt: formatDueDate(doc.expiresAt),
        shareUrl: doc.shareUrl,
        mcBusinessName: doc.businessName ?? 'Your MC',
      });
    }
    return invoiceHtml({
      coupleName: doc.coupleName ?? 'there',
      invoiceNumber: doc.documentNumber,
      invoiceTitle: doc.title || `Invoice ${doc.documentNumber}`,
      dueDate: formatDueDate(doc.dueDate),
      shareUrl: doc.shareUrl,
      mcBusinessName: doc.businessName ?? 'Your MC',
    });
  }, [doc]);

  const subject = buildSubject(doc);
  const fromAddress = doc.businessName ? `${doc.businessName} via Zebri` : 'Zebri';

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="space-y-1 rounded-card border border-border bg-surface px-4 py-3 text-caption text-text-muted">
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
      <iframe
        srcDoc={html}
        title="Email preview"
        sandbox=""
        className="flex-1 rounded-card border border-border bg-surface"
      />
    </div>
  );
}

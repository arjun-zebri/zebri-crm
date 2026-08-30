/**
 * PDF preview: shows the exact document the Download PDF button will print.
 *
 * Renders the same `buildContractPrintHtml` / `buildInvoicePrintHtml` output
 * the print window uses, inside an iframe, so the preview and the file cannot
 * disagree. Both go through the surface's public branded card, which is what
 * the couple's link renders.
 *
 * `sandbox="allow-same-origin"` only. The document links the app's own
 * stylesheets, which are render-blocking; under a fully-restrictive sandbox
 * the frame gets an opaque origin, those requests never resolve and the
 * preview stays blank. Scripts remain forbidden.
 *
 * @module components/builders/parts/preview-pdf
 */
'use client';

import { useMemo } from 'react';

import { buildContractPrintHtml } from '@/components/print/print-contract';
import { buildInvoicePrintHtml } from '@/components/print/print-invoice';
import {
  type BuilderSurface,
  useCurrentBranding,
} from '@/lib/branding/use-current-branding';

import { toPublicContract, toPublicInvoice, type PreviewDoc } from './preview-shared';

export interface PreviewPdfProps {
  doc: PreviewDoc;
  /** Which surface's branding + branded card to render. Default 'invoice'. */
  surface?: BuilderSurface | undefined;
}

export function PreviewPdf({ doc, surface = 'invoice' }: PreviewPdfProps) {
  const { branding, blocks } = useCurrentBranding(surface);

  const html = useMemo(() => {
    if (!branding) return '';
    // Draft-only fields the modal cannot know are left empty; the preview is
    // of the document, not of its signing or payment history.
    if (doc.kind === 'contract') {
      return buildContractPrintHtml(
        toPublicContract(doc, branding, blocks, {
          id: 'preview',
          expiresAt: doc.expiresAt ?? null,
          declinedAt: null,
          declinedReason: null,
          emailSentAt: null,
          eventDate: null,
          venue: null,
        }),
        { canvas: false },
      );
    }
    return buildInvoicePrintHtml(
      toPublicInvoice(doc, branding, blocks, {
        id: 'preview',
        paidAt: null,
        eventDate: null,
        venue: null,
      }),
      { canvas: false },
    );
  }, [doc, branding, blocks]);

  return (
    <iframe
      srcDoc={html}
      title="PDF preview"
      sandbox="allow-same-origin"
      className="h-full w-full bg-surface"
    />
  );
}

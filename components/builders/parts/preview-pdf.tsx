/**
 * PDF preview — renders the same HTML that `buildPdfHtml()` produces
 * for printing, inside a sandboxed iframe so its styles don't bleed
 * into the modal.
 *
 * Applies the user's branding (heading/body font, brand colour
 * accent on totals + table headers, logo) so the preview reflects
 * what the eventual PDF will look like once they hit Download PDF.
 *
 * Re-renders whenever the live form state changes. No debounce —
 * the HTML build is pure + cheap; React's batching handles the rest.
 *
 * @module components/builders/parts/preview-pdf
 */
'use client';

import { useMemo } from 'react';

import { googleFontsHref } from '@/lib/branding/fonts';
import { bodyFontFamily, headingFontFamily } from '@/lib/branding/public-surface';
import {
  type BuilderSurface,
  useCurrentBranding,
} from '@/lib/branding/use-current-branding';
import {
  buildPdfHtml,
  type PdfBrandingOpts,
  type PdfDocumentData,
} from '@/lib/pdf/generate-pdf';

import type { PreviewDoc } from './preview-shared';

export interface PreviewPdfProps {
  doc: PreviewDoc;
  /** Used to load the right branding (same one the public page
   *  surfaces use). Quote / Invoice. Default 'quote'. */
  surface?: BuilderSurface | undefined;
}

export function PreviewPdf({ doc, surface = 'quote' }: PreviewPdfProps) {
  const { branding } = useCurrentBranding(surface);

  const brandingOpts = useMemo<PdfBrandingOpts | undefined>(() => {
    if (!branding) return undefined;
    return {
      brandColor: branding.brand_color,
      textColor: branding.text_color,
      mutedColor: branding.muted_color,
      headingFontFamily: headingFontFamily(branding),
      bodyFontFamily: bodyFontFamily(branding),
      fontsHref: googleFontsHref([branding.font_heading, branding.font_body]),
      ...(branding.logo_url ? { logoUrl: branding.logo_url } : {}),
    };
  }, [branding]);

  const html = useMemo(
    () => buildPdfHtml(toPdfDoc(doc), brandingOpts),
    [doc, brandingOpts],
  );

  return (
    <iframe
      srcDoc={html}
      title="PDF preview"
      sandbox=""
      className="h-full w-full rounded-card border border-border bg-white"
    />
  );
}

function toPdfDoc(doc: PreviewDoc): PdfDocumentData {
  const subtotal = doc.items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const discountAmount =
    doc.discount && doc.discount.value > 0
      ? doc.discount.type === 'percentage'
        ? (subtotal * doc.discount.value) / 100
        : doc.discount.value
      : 0;
  const taxableAmount = subtotal - discountAmount;
  const tax = taxableAmount * ((doc.taxRate ?? 0) / 100);
  const total = taxableAmount + tax;

  return {
    type: doc.kind,
    documentNumber: doc.documentNumber,
    title: doc.title,
    status: doc.status,
    coupleName: doc.coupleName ?? '',
    ...(doc.businessName ? { businessName: doc.businessName } : {}),
    items: doc.items.map((item) => ({
      description: item.description,
      amount: item.amount,
    })),
    subtotal,
    discountType: doc.discount?.type ?? null,
    discountValue: doc.discount?.value ?? null,
    taxRate: doc.taxRate,
    total,
    notes: doc.notes,
    ...(doc.kind === 'quote' ? { expiresAt: doc.expiresAt ?? null } : {}),
    ...(doc.kind === 'invoice' ? { dueDate: doc.dueDate ?? null } : {}),
    ...(doc.kind === 'invoice' && doc.bankAccountName
      ? { bankAccountName: doc.bankAccountName }
      : {}),
    ...(doc.kind === 'invoice' && doc.bankBsb ? { bankBsb: doc.bankBsb } : {}),
    ...(doc.kind === 'invoice' && doc.bankAccountNumber
      ? { bankAccountNumber: doc.bankAccountNumber }
      : {}),
  };
}

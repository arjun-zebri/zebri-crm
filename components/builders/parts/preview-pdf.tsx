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
import type { PublicBranding } from '@/lib/branding/public-branding';
import { bodyFontFamily, headingFontFamily } from '@/lib/branding/public-surface';
import {
  type BuilderSurface,
  useCurrentBranding,
} from '@/lib/branding/use-current-branding';
import { buildPdfHtml, type PdfBrandingOpts } from '@/lib/pdf/generate-pdf';

import { toPdfDocumentData, type PreviewDoc } from './preview-shared';

export interface PreviewPdfProps {
  doc: PreviewDoc;
  /** Used to load the right branding (same one the public page
   *  surfaces use). Invoice / Contract. Default 'invoice'. */
  surface?: BuilderSurface | undefined;
}

/**
 * Project a `PublicBranding` row into the option bag `buildPdfHtml` /
 * `generateAndPrintPdf` expect.
 *
 * Shared with the builder modals' Download PDF action so the file the
 * MC downloads is styled identically to the preview they were looking
 * at when they clicked.
 *
 * @param branding Branding assembled by `useCurrentBranding`, or null.
 * @returns        PDF branding options, or undefined when unbranded.
 */
export function previewPdfBrandingOpts(
  branding: PublicBranding | null | undefined,
): PdfBrandingOpts | undefined {
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
}

export function PreviewPdf({ doc, surface = 'invoice' }: PreviewPdfProps) {
  const { branding } = useCurrentBranding(surface);

  const brandingOpts = useMemo(() => previewPdfBrandingOpts(branding), [branding]);

  const html = useMemo(
    () => buildPdfHtml(toPdfDocumentData(doc), brandingOpts, branding ?? undefined),
    [doc, brandingOpts, branding],
  );

  return (
    <iframe
      srcDoc={html}
      title="PDF preview"
      sandbox=""
      className="h-full w-full rounded-control border border-border bg-white"
    />
  );
}

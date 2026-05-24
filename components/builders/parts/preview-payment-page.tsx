/**
 * Payment-page preview — the most "real" of the three tabs.
 *
 * Renders the user's actual branded payment page using the same
 * `PublicBlockRenderer` the `/quote/[token]` and `/invoice/[token]`
 * routes use, so the MC sees a pixel-faithful preview of what the
 * couple will see when they click the share link.
 *
 * - Pulls live branding (colors + fonts + density + block tree) from
 *   `useCurrentBranding(surface)`.
 * - Builds a `PublicDocData` from the live form state — no DB round-
 *   trip needed.
 * - Header (logo + business name + favicon font links) lives in the
 *   modal scope via `useBrandingHead()` — restored on unmount so the
 *   dashboard chrome keeps its own favicon.
 *
 * @module components/builders/parts/preview-payment-page
 */
'use client';

import {
  type PublicDocData,
  PublicBlockRenderer,
} from '@/lib/branding/public-renderer';
import {
  bodyFontFamily,
  DENSITY_PAD,
  headingFontFamily,
  useBrandingHead,
} from '@/lib/branding/public-surface';
import {
  type BuilderSurface,
  useCurrentBranding,
} from '@/lib/branding/use-current-branding';

import type { PreviewDoc } from './preview-shared';

export interface PreviewPaymentPageProps {
  doc: PreviewDoc;
  surface: BuilderSurface;
}

export function PreviewPaymentPage({ doc, surface }: PreviewPaymentPageProps) {
  const { branding, blocks, loading } = useCurrentBranding(surface);
  useBrandingHead(branding);

  if (loading || !branding) {
    return (
      <div className="flex h-full items-center justify-center rounded-card border border-border bg-surface-muted/40">
        <div className="h-3 w-32 animate-pulse rounded bg-surface-muted" />
      </div>
    );
  }

  const publicDoc: PublicDocData = {
    title: doc.title,
    refNumber: doc.documentNumber,
    expiresAt: doc.expiresAt ?? null,
    items: doc.items.map((item) => ({
      id: item.id,
      description: item.description,
      amount: item.amount,
    })),
    subtotal: doc.items.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    taxRate: doc.taxRate ?? 0,
    discountType: doc.discount?.type ?? null,
    discountValue: doc.discount?.value ?? null,
  };

  const padding = DENSITY_PAD[branding.density];
  const bg = branding.secondary_color || branding.surface_color;

  return (
    <div
      className={`h-full overflow-y-auto rounded-card border border-border ${padding.page}`}
      style={{
        backgroundColor: bg,
        color: branding.text_color,
        fontFamily: bodyFontFamily(branding),
        fontWeight: branding.font_body_weight,
      }}
    >
      <div
        className="mx-auto"
        style={{
          maxWidth: 640,
          fontSize: `${(branding.font_scale ?? 1) * 16}px`,
          fontFamily: headingFontFamily(branding),
        }}
      >
        <PublicBlockRenderer
          blocks={blocks}
          branding={branding}
          doc={publicDoc}
          hideAction
        />

        {/* Notes — the block renderer doesn't include a notes
            block by default (the public pages render notes
            outside the renderer), so the preview mirrors that
            by appending the notes section here. */}
        {doc.notes ? (
          <div style={{ marginTop: 24 }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: branding.muted_color,
                margin: '0 0 8px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontFamily: headingFontFamily(branding),
              }}
            >
              Notes
            </p>
            <p
              style={{
                fontSize: 13,
                color: branding.muted_color,
                whiteSpace: 'pre-line',
                lineHeight: 1.6,
              }}
            >
              {doc.notes}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

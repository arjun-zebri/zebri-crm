/**
 * Payment-page preview — the most "real" of the three tabs.
 *
 * Renders the user's actual branded payment page using the same
 * `PublicBlockRenderer` the `/invoice/[token]` route uses, so the MC
 * sees a pixel-faithful preview of what the couple will see when they
 * click the share link.
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

import { useAutoAnimate } from '@formkit/auto-animate/react';

import { contractPrintElement } from '@/components/print/print-contract';
import { DOC_MAX_WIDTH_PX } from '@/lib/branding/document-frame';
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

import { toPublicContract, type PreviewDoc } from './preview-shared';

export interface PreviewPaymentPageProps {
  doc: PreviewDoc;
  surface: BuilderSurface;
}

export function PreviewPaymentPage({ doc, surface }: PreviewPaymentPageProps) {
  const { branding, blocks, loading } = useCurrentBranding(surface);
  useBrandingHead(branding);
  // Auto-animate the block stack so block-level changes (e.g. the
  // action block appearing / disappearing when the MC toggles
  // "Accept card payments") glide instead of snapping.
  const [blockStackRef] = useAutoAnimate<HTMLDivElement>();

  if (loading || !branding) {
    return (
      <div className="flex h-full items-center justify-center rounded-control border border-border bg-surface-muted/40">
        <div className="h-3 w-32 animate-pulse rounded-control bg-surface-muted" />
      </div>
    );
  }

  const publicDoc: PublicDocData = {
    title: doc.title,
    refNumber: doc.documentNumber,
    // Invoices carry a due date (`dueDate`); other surfaces an expiry
    // (`expiresAt`). The title meta reads `expiresAt` + `expiresLabel`, so map the
    // invoice due date across and label it "Due" (else the row silently vanishes).
    // When a payment schedule exists, the deposit/final due dates show in the
    // schedule block, so suppress the header due row to avoid a duplicate date —
    // matching the live /invoice/[token] page.
    expiresAt: doc.paymentSchedule ? null : (doc.expiresAt ?? doc.dueDate ?? null),
    expiresLabel: doc.kind === 'invoice' ? 'Due' : 'Expires',
    coupleName: doc.coupleName ?? undefined,
    items: doc.items.map((item) => ({
      id: item.id,
      description: item.description,
      amount: item.amount,
    })),
    subtotal: doc.items.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    taxRate: doc.taxRate ?? 0,
    gstInclusive: doc.gstInclusive ?? false,
    discountType: doc.discount?.type ?? null,
    discountValue: doc.discount?.value ?? null,
    paymentSchedule: doc.paymentSchedule ?? null,
  };

  const padding = DENSITY_PAD[branding.density];
  // The page background is the surface colour (aliased as page_background),
  // exactly what the public /invoice/[token] page paints. The old expression
  // read `secondary_color || surface_color`, but secondary_color always
  // defaults to a grey, so the fallback never fired and every preview showed
  // grey regardless of the MC's chosen background.
  const bg = branding.page_background || branding.surface_color;

  // Contract surface — split the block tree at the contractBody
  // marker. Pre-blocks render above the contract HTML body +
  // signature sections; post-blocks render below. Mirrors the
  // public /contract/[token] page exactly.
  const isContract = doc.kind === 'contract';
  // Invoices render the whole tree; the contract card splits its own.
  const preBlocks = blocks;

  return (
    <div
      className={`h-full overflow-y-auto rounded-control border border-border ${padding.page}`}
      style={{
        backgroundColor: bg,
        color: branding.text_color,
        fontFamily: bodyFontFamily(branding),
        fontWeight: branding.font_body_weight,
      }}
    >
      {/* @container/doc establishes the container query context the public block
          renderers use (e.g. payment-details switches label/value to a row at
          @sm/doc). Without it those responsive variants never fire and values
          stack under their labels. */}
      <div
        ref={blockStackRef}
        className="mx-auto @container/doc"
        style={{
          maxWidth: DOC_MAX_WIDTH_PX,
          fontFamily: headingFontFamily(branding),
        }}
      >
        {isContract ? (
          // The SAME `ContractBrandedCard` the public page, the PDF preview
          // and the print window render, composed by the same function. The
          // preview used to hand-assemble pre-blocks + its own body/sign
          // surface + post-blocks, which is exactly how it drifted from the
          // link (a bare pad wrapper vs the card's bordered section).
          contractPrintElement(
            toPublicContract(doc, branding, blocks, {
              id: 'preview',
              expiresAt: doc.expiresAt ?? null,
              declinedAt: null,
              declinedReason: null,
              emailSentAt: null,
              eventDate: null,
              venue: null,
            }),
          )
        ) : (
          <PublicBlockRenderer
            blocks={preBlocks}
            branding={branding}
            doc={publicDoc}
            // Invoices hide the action block only when card payments are
            // off; when on, its "Pay with card" button is what the couple
            // sees.
            hideAction={!doc.stripePaymentEnabled}
          />
        )}

        {/* Notes — the block renderer doesn't include a notes
            block by default (the public pages render notes
            outside the renderer), so the preview mirrors that
            by appending the notes section here. The cardSection
            padding matches the horizontal/vertical padding the
            renderer's blocks use, so notes line up with the
            footer / line-items / totals above. */}
        {!isContract && doc.notes ? (
          <div className={`mt-6 ${padding.cardSection}`}>
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


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

import type { PreviewDoc } from './preview-shared';

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
  const markerIdx = isContract
    ? blocks.findIndex((b) => b.type === 'contractBody')
    : -1;
  const preBlocks = isContract && markerIdx >= 0 ? blocks.slice(0, markerIdx) : blocks;
  const postBlocks = isContract && markerIdx >= 0 ? blocks.slice(markerIdx + 1) : [];

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
        <PublicBlockRenderer
          blocks={preBlocks}
          branding={branding}
          doc={publicDoc}
          // Invoices hide the action block only when card payments
          // are off — when on, the action block's "Pay with card"
          // button is exactly what the couple will see. Quotes
          // always show the action so the MC can preview the
          // Accept-quote affordance. Contracts hide the action
          // because the actual signing flow is rendered below
          // (see ContractSigningPlaceholder).
          hideAction={
            (surface === 'invoice' && !doc.stripePaymentEnabled) ||
            surface === 'contract'
          }
        />

        {/* Contract body + signature surface (contract surface only).
            Renders between pre-blocks and post-blocks, matching the
            public /contract/[token] page's layout exactly. */}
        {isContract ? (
          <ContractBodySurface
            doc={doc}
            branding={branding}
            cardSectionPad={padding.cardSection}
          />
        ) : null}

        {/* Post-marker blocks (contract surface only). */}
        {isContract && postBlocks.length > 0 ? (
          <PublicBlockRenderer
            blocks={postBlocks}
            branding={branding}
            doc={publicDoc}
            hideAction
          />
        ) : null}

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

/* ─── Contract body + signature surface ──────────────────────── */

function ContractBodySurface({
  doc,
  branding,
  cardSectionPad,
}: {
  doc: PreviewDoc;
  branding: ReturnType<typeof useCurrentBranding>['branding'];
  cardSectionPad: string;
}) {
  if (!branding) return null;
  const html = doc.lockedHtml || doc.contractHtml || '';
  const muted = branding.muted_color;
  const text = branding.text_color;
  return (
    <>
      {/* Body */}
      <div className={cardSectionPad}>
        <div
          className="contract-content text-sm"
          style={{ color: text, fontFamily: bodyFontFamily(branding) }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      {/* MC countersignature */}
      <div
        className={`${cardSectionPad} border-t`}
        style={{ borderColor: muted + '30' }}
      >
        <p className="text-xs font-medium mb-1" style={{ color: muted }}>
          Signed by MC
        </p>
        <p
          className="text-xl"
          style={{
            color: text,
            fontFamily: 'Caveat, "Brush Script MT", cursive',
          }}
        >
          {doc.mcSignatureName || doc.businessName || 'Your MC'}
        </p>
        {doc.businessName ? (
          <p className="text-xs mt-1" style={{ color: muted }}>
            {doc.businessName}
          </p>
        ) : null}
      </div>

      {/* Couple signature placeholder (non-functional preview) */}
      <div
        className={`${cardSectionPad} border-t space-y-4`}
        style={{ borderColor: muted + '30' }}
      >
        <p className="text-xs font-medium" style={{ color: muted }}>
          Sign to accept
        </p>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: muted }}>
            Your full legal name
          </label>
          <input
            type="text"
            placeholder={doc.coupleName ?? ''}
            readOnly
            tabIndex={-1}
            aria-hidden="true"
            className="w-full text-sm border px-3 py-2.5 cursor-not-allowed bg-surface-muted/30"
            style={{
              borderRadius: branding.corner_radius,
              borderColor: muted + '30',
              color: text,
            }}
          />
        </div>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={false}
            readOnly
            tabIndex={-1}
            aria-hidden="true"
            className="mt-0.5 w-4 h-4 cursor-not-allowed"
          />
          <span className="text-sm" style={{ color: text }}>
            I agree to the terms above and intend my typed name to serve as my legal signature.
          </span>
        </label>
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            disabled
            style={{
              backgroundColor: branding.brand_color,
              color: '#ffffff',
              borderRadius: branding.corner_radius,
            }}
            className="text-sm font-semibold px-5 py-2.5 cursor-not-allowed opacity-90"
          >
            Sign contract
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            disabled
            style={{
              borderRadius: branding.corner_radius,
              borderColor: muted + '40',
              color: muted,
            }}
            className="text-sm font-medium px-4 py-2.5 border cursor-not-allowed"
          >
            Decline
          </button>
        </div>
      </div>
    </>
  );
}

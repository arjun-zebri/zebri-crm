/**
 * The proposal, exactly as the couple sees it — ONE component, three
 * surfaces:
 * - `/proposal/[token]` (real data + live handlers + accept actions),
 * - the composer's Page preview (draft data + the MC's current
 *   branding, read-only),
 * - the branding editor's Proposal surface (sample data + the kit
 *   values being edited).
 *
 * Keeping the layout in one place is what guarantees the preview, the
 * branding canvas, and the sent page can never drift apart again.
 *
 * Layout: eyebrow + expiry, the couple's names as the display
 * heading, "A proposal from {business}", hero image, the MC's note as
 * an italic lead, the option chooser (multi-option only), the chosen
 * option's priced detail, then the `actions` slot (real accept block
 * on the public page; {@link StaticAcceptCta} in previews).
 *
 * @module components/proposal/proposal-page-view
 */
'use client';

import type { ReactNode } from 'react';

import { ProposalOptionChooser } from '@/components/proposal/option-chooser';
import { ProposalSelection } from '@/components/proposal/option-selection';
import { getTextColor } from '@/lib/branding/contrast';
import { FONT_STACKS } from '@/lib/branding/fonts';
import type { PublicBranding } from '@/lib/branding/public-surface';
import { htmlToPlainText } from '@/lib/branding/sanitize';
import {
  formatDate,
  type ProposalViewBranding,
  type PublicProposalOption,
} from '@/lib/payments/proposal-view';

/** Resolve a {@link PublicBranding} (RPC payload / current-branding
 *  hook / editor kit) into the view's ready-to-apply scalar shape. */
export function viewBranding(b: PublicBranding): ProposalViewBranding {
  return {
    pageBg: b.surface_color || '#fafafa',
    textColor: b.text_color || '#111827',
    mutedColor: b.muted_color || '#6B7280',
    brand: b.brand_color || '#111827',
    radius: b.corner_radius ?? 16,
    headingFontFamily: FONT_STACKS[b.font_heading],
    bodyFontFamily: FONT_STACKS[b.font_body],
    headingWeight: b.font_weight ?? 600,
    logoUrl: b.logo_url,
    headerImageUrl: b.header_image_url,
    businessName: b.business_name ? htmlToPlainText(b.business_name) : null,
  };
}

export interface ProposalPageViewProps {
  coupleName: string;
  proposalNumber: string;
  notes: string | null;
  expiresAt: string | null;
  options: PublicProposalOption[];
  /** Drives which affordances render; previews pass 'active'. */
  state: 'active' | 'accepted' | 'declined' | 'expired';
  branding: ProposalViewBranding;
  chosenId: string | null;
  selection: Record<string, boolean>;
  /** Omit both handlers for a read-only preview. */
  onChoose?: ((optionId: string) => void) | undefined;
  onToggle?: ((itemId: string, next: boolean) => void) | undefined;
  /** The accept/decline block. The public page passes the real one;
   *  previews pass {@link StaticAcceptCta} (or nothing). */
  actions?: ReactNode;
}

export function ProposalPageView({
  coupleName,
  proposalNumber,
  notes,
  expiresAt,
  options,
  state,
  branding,
  chosenId,
  selection,
  onChoose,
  onToggle,
  actions,
}: ProposalPageViewProps) {
  const { brand, textColor, mutedColor, radius, headingFontFamily, headingWeight } = branding;
  const interactive = state === 'active' && !!onToggle;
  const chosen = options.find((o) => o.id === chosenId) ?? null;

  return (
    <div className="space-y-8">
      {/* ─── Header ─── */}
      <header>
        {branding.logoUrl ? (
          // User-uploaded brand asset — no next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoUrl}
            alt={branding.businessName || 'Logo'}
            className="mb-6 max-h-10 object-contain"
          />
        ) : null}
        <div className="flex items-baseline justify-between gap-4">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: brand }}
          >
            Wedding proposal
          </p>
          {expiresAt && state === 'active' ? (
            <p className="shrink-0 text-xs" style={{ color: mutedColor }}>
              Expires {formatDate(expiresAt)}
            </p>
          ) : null}
        </div>
        <h1
          className="mt-3 text-4xl leading-tight"
          style={{ color: textColor, fontFamily: headingFontFamily, fontWeight: headingWeight }}
        >
          {coupleName}
        </h1>
        {branding.businessName ? (
          <p className="mt-2 text-sm" style={{ color: mutedColor }}>
            A proposal from {branding.businessName}
          </p>
        ) : null}
      </header>

      {branding.headerImageUrl ? (
        <div className="overflow-hidden" style={{ borderRadius: radius }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={branding.headerImageUrl} alt="" className="block h-56 w-full object-cover" />
        </div>
      ) : null}

      {/* The MC's note leads the page — the personal message, read
          before any packages or pricing. */}
      {notes ? (
        <section>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: brand }}
          >
            A note from us
          </p>
          <p
            className="mt-2 text-lg italic leading-relaxed whitespace-pre-wrap"
            style={{ color: textColor, fontFamily: headingFontFamily }}
          >
            {notes}
          </p>
        </section>
      ) : null}

      {/* Multi-option chooser while active; the accepted view pins to
          the recorded choice. */}
      {state === 'active' && options.length > 1 ? (
        <ProposalOptionChooser
          options={options}
          chosenId={chosenId}
          onChoose={onChoose}
          disabled={!onChoose}
          branding={branding}
        />
      ) : null}

      {chosen ? (
        <ProposalSelection
          option={chosen}
          selection={selection}
          onToggle={onToggle}
          locked={!interactive}
          heading={state === 'accepted' ? 'Chosen package' : 'Your package'}
          branding={branding}
        />
      ) : options.length > 1 ? (
        <p className="text-sm" style={{ color: mutedColor }}>
          Select a package above to see what&apos;s included.
        </p>
      ) : null}

      {actions}

      <p className="text-center text-[10px]" style={{ color: mutedColor }}>
        {proposalNumber}
      </p>
    </div>
  );
}

/** Non-interactive stand-in for the accept block, used by previews so
 *  the MC sees the couple's full page including the CTA. */
export function StaticAcceptCta({
  expiresAt,
  branding,
}: {
  expiresAt: string | null;
  branding: ProposalViewBranding;
}) {
  return (
    <div aria-hidden>
      <div
        className="w-full py-3.5 text-center text-[15px] font-medium"
        style={{
          backgroundColor: branding.brand,
          color: getTextColor(branding.brand),
          borderRadius: Math.min(branding.radius, 14),
        }}
      >
        Accept &amp; reserve our date
      </div>
      {expiresAt ? (
        <p className="mt-2.5 text-center text-xs" style={{ color: branding.mutedColor }}>
          This proposal is held for you until {formatDate(expiresAt)}
        </p>
      ) : null}
      <p
        className="mt-4 text-center text-xs underline underline-offset-2"
        style={{ color: branding.mutedColor }}
      >
        Decline this proposal
      </p>
    </div>
  );
}

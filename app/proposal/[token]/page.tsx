/**
 * Public proposal page — orchestrator.
 *
 * Reached via the share-token capability URL (`/proposal/<token>`).
 * Loads `get_public_proposal(token)` through React Query, and while
 * the proposal is active lets the couple pick a package option
 * (multi-option proposals show the chooser; single-option skips it),
 * adjust the add-on ticks seeded from the MC's pre-ticks, and accept
 * with a two-step confirm — the acceptance carries the chosen option
 * + final selection to `accept_proposal`.
 *
 * All view state derives from the query payload + the couple's picks
 * (no fetch-then-setState effects): the accepted view pins to the
 * RECORDED choice (`accepted_option_id` + `accepted_addon_selection`)
 * so the page is always the receipt of what was agreed.
 *
 * States: loading / not_found / active / expired / accepted /
 * declined. Scalar branding (colors, fonts, logo, density, radius)
 * applies; block-tree layouts are deferred for proposals — a block
 * tree can't express the option chooser.
 *
 * @module app/proposal/[token]/page
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { Html } from '@/lib/branding/public-blocks/html';
import {
  bodyFontFamily,
  DENSITY_PAD,
  headingFontFamily,
  useBrandingHead,
} from '@/lib/branding/public-surface';
import { htmlToPlainText } from '@/lib/branding/sanitize';
import { createClient } from '@/lib/supabase/client';

import { ProposalAcceptActions } from './_components/proposal-accept-actions';
import { ProposalOptionChooser } from './_components/proposal-option-chooser';
import { ProposalSelection } from './_components/proposal-selection';
import {
  ProposalLoading,
  ProposalStatusBanner,
  ProposalUnavailable,
} from './_components/proposal-state-cards';
import {
  defaultSelection,
  deriveState,
  formatCurrency,
  formatDate,
  selectionTotal,
  type PageState,
  type PublicProposal,
} from './_components/public-proposal';

export default function PublicProposalPage() {
  const params = useParams<{ token: string }>();
  const supabase = createClient();

  // The couple's live picks; null until they interact so the derived
  // defaults (MC pre-ticks / recorded acceptance) stay authoritative.
  const [pickedOptionId, setPickedOptionId] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, boolean> | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: proposal,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['public-proposal', params.token],
    queryFn: async (): Promise<PublicProposal | null> => {
      const { data, error } = await supabase.rpc('get_public_proposal', {
        token: params.token,
      });
      if (error) throw error;
      return (data as unknown as PublicProposal) ?? null;
    },
    retry: false,
  });

  useBrandingHead(proposal ?? null);

  const pageState: PageState = isLoading
    ? 'loading'
    : !proposal
      ? 'not_found'
      : deriveState(proposal);

  /* ─── Derived choice + selection ─── */
  const accepted = pageState === 'accepted';
  const effectiveChosenId = accepted
    ? proposal?.accepted_option_id ?? null
    : pickedOptionId ?? (proposal?.options.length === 1 ? proposal.options[0]!.id : null);
  const chosen = proposal?.options.find((o) => o.id === effectiveChosenId) ?? null;
  const selection: Record<string, boolean> = accepted
    ? proposal?.accepted_addon_selection ?? {}
    : picks ?? (chosen ? defaultSelection(chosen) : {});

  const handleChoose = (optionId: string) => {
    const option = proposal?.options.find((o) => o.id === optionId);
    if (!option) return;
    setPickedOptionId(optionId);
    setPicks(defaultSelection(option));
  };

  const handleAccept = async () => {
    if (!chosen) return;
    setActionLoading(true);
    setActionError(null);
    const { data } = await supabase.rpc('accept_proposal', {
      token: params.token,
      chosen_option_id: chosen.id,
      addon_selection: selection,
    });
    setActionLoading(false);
    const res = data as { error?: string } | null;
    // expired / already_actioned both surface correctly from a
    // refetch (state derives from the payload); anything else is a
    // retryable failure.
    if (res?.error && res.error !== 'expired' && res.error !== 'already_actioned') {
      setActionError('Something went wrong. Please try again.');
      return;
    }
    await refetch();
  };

  const handleDecline = async () => {
    setActionLoading(true);
    setActionError(null);
    const { data } = await supabase.rpc('decline_proposal', { token: params.token });
    setActionLoading(false);
    const res = data as { error?: string } | null;
    if (res?.error && res.error !== 'already_actioned') {
      setActionError('Something went wrong. Please try again.');
      return;
    }
    await refetch();
  };

  /* ─── Branding-derived values ─── */
  const pageBg = proposal?.surface_color || '#fafafa';
  const textColor = proposal?.text_color || '#111827';
  const mutedColor = proposal?.muted_color || '#6B7280';
  const brand = proposal?.brand_color || '#111827';
  const radius = proposal?.corner_radius ?? 16;
  const headingStack = proposal ? headingFontFamily(proposal) : undefined;
  const bodyStack = proposal ? bodyFontFamily(proposal) : undefined;
  const headingWeight = proposal?.font_weight ?? 600;
  const pad = DENSITY_PAD[proposal?.density ?? 'cozy'];

  const totalLabel = chosen ? formatCurrency(selectionTotal(chosen, selection)) : '';

  return (
    <div
      className={`min-h-screen ${pad.page} px-4`}
      style={{ background: pageBg, color: textColor, fontFamily: bodyStack }}
    >
      <div className="max-w-xl mx-auto">
        {proposal && pageState === 'accepted' ? (
          <ProposalStatusBanner
            kind="accepted"
            acceptedAt={proposal.accepted_at}
            businessName={proposal.business_name}
          />
        ) : null}
        {proposal && pageState === 'declined' ? (
          <ProposalStatusBanner kind="declined" mutedColor={mutedColor} />
        ) : null}
        {proposal && pageState === 'expired' ? (
          <ProposalStatusBanner
            kind="expired"
            expiresAt={proposal.expires_at}
            businessName={proposal.business_name}
          />
        ) : null}

        {pageState === 'loading' ? <ProposalLoading radius={radius} /> : null}

        {pageState === 'not_found' ? (
          <ProposalUnavailable radius={radius} textColor={textColor} mutedColor={mutedColor} />
        ) : null}

        {proposal && pageState !== 'not_found' && pageState !== 'loading' ? (
          // Open editorial layout — sections directly on the branded
          // page background (no card chrome), per the proposal mock.
          <div className="space-y-8">
            {/* ─── Header ─── */}
            <header>
              {proposal.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={proposal.logo_url}
                  alt={htmlToPlainText(proposal.business_name) || 'Logo'}
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
                {proposal.expires_at && pageState === 'active' ? (
                  <p className="shrink-0 text-xs" style={{ color: mutedColor }}>
                    Expires {formatDate(proposal.expires_at)}
                  </p>
                ) : null}
              </div>
              <h1
                className="mt-3 text-4xl leading-tight"
                style={{ color: textColor, fontFamily: headingStack, fontWeight: headingWeight }}
              >
                {proposal.couple_name}
              </h1>
              {proposal.business_name ? (
                <p className="mt-2 text-sm" style={{ color: mutedColor }}>
                  A proposal from <Html value={proposal.business_name} allowLists={false} />
                </p>
              ) : null}
            </header>

            {proposal.header_image_url ? (
              <div className="overflow-hidden" style={{ borderRadius: radius }}>
                {/* User-uploaded brand asset — no next/image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proposal.header_image_url}
                  alt=""
                  className="block h-56 w-full object-cover"
                />
              </div>
            ) : null}

            {/* The MC's note leads the page — the personal message,
                read before any packages or pricing. */}
            {proposal.notes ? (
              <section>
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: brand }}
                >
                  A note from us
                </p>
                <p
                  className="mt-2 text-lg italic leading-relaxed whitespace-pre-wrap"
                  style={{ color: textColor, fontFamily: headingStack }}
                >
                  {proposal.notes}
                </p>
              </section>
            ) : null}

            {/* Multi-option chooser while active; the accepted view
                pins to the recorded choice. */}
            {pageState === 'active' && proposal.options.length > 1 ? (
              <ProposalOptionChooser
                options={proposal.options}
                chosenId={effectiveChosenId}
                onChoose={handleChoose}
                disabled={actionLoading}
                brand={brand}
                textColor={textColor}
                mutedColor={mutedColor}
                radius={Math.min(radius, 12)}
              />
            ) : null}

            {chosen ? (
              <ProposalSelection
                option={chosen}
                selection={selection}
                onToggle={(itemId, next) => setPicks({ ...selection, [itemId]: next })}
                locked={pageState !== 'active' || actionLoading}
                heading={pageState === 'accepted' ? 'Chosen package' : 'Your package'}
                brand={brand}
                textColor={textColor}
                mutedColor={mutedColor}
                radius={radius}
                headingFontFamily={headingStack}
                headingWeight={headingWeight}
              />
            ) : proposal.options.length > 1 ? (
              <p className="text-sm" style={{ color: mutedColor }}>
                Select a package above to see what&apos;s included.
              </p>
            ) : null}

            {pageState === 'active' ? (
              <ProposalAcceptActions
                chosenOptionTitle={chosen?.title ?? null}
                totalLabel={totalLabel}
                expiresAt={proposal.expires_at}
                onAccept={handleAccept}
                onDecline={handleDecline}
                actionLoading={actionLoading}
                actionError={actionError}
                brand={brand}
                radius={radius}
                textColor={textColor}
                mutedColor={mutedColor}
              />
            ) : null}

            <p className="text-center text-[10px]" style={{ color: mutedColor }}>
              {proposal.proposal_number}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

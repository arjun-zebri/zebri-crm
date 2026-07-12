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
 * The layout itself lives in the shared {@link ProposalPageView} —
 * the same component the composer preview and the branding editor
 * render — so what the couple sees here is pixel-identical to what
 * the MC previewed. This page only owns data + the live handlers.
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

import { ProposalPageView, viewBranding } from '@/components/proposal/proposal-page-view';
import { DENSITY_PAD, useBrandingHead } from '@/lib/branding/public-surface';
import {
  defaultSelection,
  deriveState,
  formatCurrency,
  selectionTotal,
  type PageState,
  type PublicProposal,
} from '@/lib/payments/proposal-view';
import { createClient } from '@/lib/supabase/client';

import { ProposalAcceptActions } from './_components/proposal-accept-actions';
import {
  ProposalLoading,
  ProposalStatusBanner,
  ProposalUnavailable,
} from './_components/proposal-state-cards';

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
  const branding = proposal ? viewBranding(proposal) : null;
  const pad = DENSITY_PAD[proposal?.density ?? 'cozy'];
  const totalLabel = chosen ? formatCurrency(selectionTotal(chosen, selection)) : '';

  return (
    <div
      className={`min-h-screen ${pad.page} px-4`}
      style={{
        background: branding?.pageBg ?? '#fafafa',
        color: branding?.textColor ?? '#111827',
        fontFamily: branding?.bodyFontFamily,
      }}
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
          <ProposalStatusBanner kind="declined" mutedColor={branding!.mutedColor} />
        ) : null}
        {proposal && pageState === 'expired' ? (
          <ProposalStatusBanner
            kind="expired"
            expiresAt={proposal.expires_at}
            businessName={proposal.business_name}
          />
        ) : null}

        {pageState === 'loading' ? <ProposalLoading radius={16} /> : null}

        {pageState === 'not_found' ? (
          <ProposalUnavailable radius={16} textColor="#111827" mutedColor="#6B7280" />
        ) : null}

        {proposal && branding && pageState !== 'not_found' && pageState !== 'loading' ? (
          <ProposalPageView
            coupleName={proposal.couple_name}
            proposalNumber={proposal.proposal_number}
            notes={proposal.notes}
            expiresAt={proposal.expires_at}
            options={proposal.options}
            state={pageState}
            branding={branding}
            chosenId={effectiveChosenId}
            selection={selection}
            onChoose={pageState === 'active' && !actionLoading ? handleChoose : undefined}
            onToggle={
              pageState === 'active' && !actionLoading
                ? (itemId, next) => setPicks({ ...selection, [itemId]: next })
                : undefined
            }
            actions={
              pageState === 'active' ? (
                <ProposalAcceptActions
                  chosenOptionTitle={chosen?.title ?? null}
                  totalLabel={totalLabel}
                  expiresAt={proposal.expires_at}
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                  actionLoading={actionLoading}
                  actionError={actionError}
                  brand={branding.brand}
                  radius={branding.radius}
                  textColor={branding.textColor}
                  mutedColor={branding.mutedColor}
                  labels={branding.labels}
                />
              ) : undefined
            }
          />
        ) : null}
      </div>
    </div>
  );
}

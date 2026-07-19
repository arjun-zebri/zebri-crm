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
 * The MC's branding block tree drives the chrome: the header banner,
 * business name, any custom text, the Accept **action block** (its
 * label + button colour/radius) and the footer (contact + ABN) render
 * around the fixed proposal core ({@link ProposalPageView} variant
 * `blockCore` — the chooser + priced selection, which can't be a block
 * tree). Same split-at-marker model the public invoice/contract pages
 * use. When the MC has no saved blocks (or the migration hasn't
 * reached the DB yet), the page renders the self-contained standalone
 * layout as a fallback.
 *
 * All view state derives from the query payload + the couple's picks
 * (no fetch-then-setState effects): the accepted view pins to the
 * RECORDED choice (`accepted_option_id` + `accepted_addon_selection`).
 *
 * @module app/proposal/[token]/page
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import {
  ProposalDocumentBody,
  type ProposalActionStyle,
} from '@/components/proposal/proposal-document-body';
import { viewBranding } from '@/components/proposal/proposal-page-view';
import { DENSITY_PAD, useBrandingHead } from '@/lib/branding/public-surface';
import { repairBlocks } from '@/lib/branding/validate-blocks';
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

  /* The interactive accept/decline UI, styled from the MC's action
     block. The shared document body calls this only while the proposal
     is active; the accepted / expired views render without a CTA. */
  const renderAccept = ({ style }: { style: ProposalActionStyle }) =>
    proposal && branding ? (
      <ProposalAcceptActions
        branding={proposal}
        chosenOptionTitle={chosen?.title ?? null}
        totalLabel={totalLabel}
        expiresAt={proposal.expires_at}
        onAccept={handleAccept}
        onDecline={handleDecline}
        actionLoading={actionLoading}
        actionError={actionError}
        brand={style.color}
        radius={style.radius}
        textColor={branding.textColor}
        mutedColor={branding.mutedColor}
        borderColor={branding.borderColor}
        surfaceColor={branding.pageBg}
        labels={{
          ...branding.labels,
          accept: style.primaryLabel ? { text: style.primaryLabel } : branding.labels.accept,
          decline: style.secondaryLabel ? { text: style.secondaryLabel } : branding.labels.decline,
        }}
      />
    ) : null;

  return (
    <div
      className={`min-h-screen ${pad.page} px-4`}
      style={{
        background: branding?.pageBg ?? '#fafafa',
        color: branding?.textColor ?? '#111827',
        fontFamily: branding?.bodyFontFamily,
      }}
    >
      <div className="max-w-xl mx-auto @container/doc">
        {proposal && pageState === 'accepted' && branding ? (
          <ProposalStatusBanner
            branding={proposal}
            kind="accepted"
            acceptedAt={proposal.accepted_at}
            businessName={proposal.business_name}
            mutedColor={branding.mutedColor}
            borderColor={branding.borderColor}
            cornerRadius={branding.cornerRadius}
            surfaceColor={branding.pageBg}
          />
        ) : null}
        {proposal && pageState === 'declined' && branding ? (
          <ProposalStatusBanner
            branding={proposal}
            kind="declined"
            mutedColor={branding.mutedColor}
            borderColor={branding.borderColor}
            cornerRadius={branding.cornerRadius}
            surfaceColor={branding.pageBg}
          />
        ) : null}
        {proposal && pageState === 'expired' && branding ? (
          <ProposalStatusBanner
            branding={proposal}
            kind="expired"
            expiresAt={proposal.expires_at}
            businessName={proposal.business_name}
            mutedColor={branding.mutedColor}
            borderColor={branding.borderColor}
            cornerRadius={branding.cornerRadius}
            surfaceColor={branding.pageBg}
          />
        ) : null}

        {pageState === 'loading' && branding ? (
          <ProposalLoading
            radius={branding.radius}
            surfaceColor={branding.pageBg}
            borderColor={branding.borderColor}
            mutedColor={branding.mutedColor}
          />
        ) : null}

        {pageState === 'not_found' && branding ? (
          <ProposalUnavailable
            radius={branding.radius}
            textColor={branding.textColor}
            mutedColor={branding.mutedColor}
            surfaceColor={branding.pageBg}
            borderColor={branding.borderColor}
          />
        ) : null}

        {proposal && branding && pageState !== 'not_found' && pageState !== 'loading' ? (
          <ProposalDocumentBody
            blocks={proposal.branding_blocks && proposal.branding_blocks.length > 0
              ? repairBlocks('proposal', proposal.branding_blocks)
              : null}
            branding={proposal}
            title={proposal.title}
            coupleName={proposal.couple_name}
            proposalNumber={proposal.proposal_number}
            notes={proposal.notes}
            expiresAt={proposal.expires_at}
            options={proposal.options}
            state={
              pageState === 'accepted'
                ? 'accepted'
                : pageState === 'declined'
                  ? 'declined'
                  : pageState === 'expired'
                    ? 'expired'
                    : 'active'
            }
            chosenId={effectiveChosenId}
            selection={selection}
            onChoose={pageState === 'active' && !actionLoading ? handleChoose : undefined}
            onToggle={
              pageState === 'active' && !actionLoading
                ? (itemId, next) => setPicks({ ...selection, [itemId]: next })
                : undefined
            }
            renderAccept={renderAccept}
          />
        ) : null}
      </div>
    </div>
  );
}

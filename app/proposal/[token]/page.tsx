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

import { ProposalPageView, viewBranding } from '@/components/proposal/proposal-page-view';
import { findActionStyle, PublicBlockRenderer } from '@/lib/branding/public-renderer';
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

  /* ─── Block layout (chrome around the fixed core) ─── */
  const blocks = proposal?.branding_blocks ?? null;
  const pbIdx = blocks?.findIndex((b) => b.type === 'proposalBody') ?? -1;
  const useBlocks = !!blocks && blocks.length > 0 && pbIdx >= 0;
  const preBlocks = useBlocks ? blocks!.slice(0, pbIdx) : [];
  const restBlocks = useBlocks ? blocks!.slice(pbIdx + 1) : [];
  const actIdx = restBlocks.findIndex((b) => b.type === 'action');
  const betweenBlocks = actIdx >= 0 ? restBlocks.slice(0, actIdx) : restBlocks;
  const postBlocks = actIdx >= 0 ? restBlocks.slice(actIdx + 1) : [];
  const actionStyle = branding
    ? findActionStyle(blocks, { brandColor: branding.brand, cornerRadius: branding.radius })
    : null;
  const doc = proposal
    ? {
        title: proposal.title,
        refNumber: proposal.proposal_number,
        expiresAt: proposal.expires_at,
        items: [],
        subtotal: 0,
        taxRate: 0,
      }
    : null;

  const acceptBlock =
    branding && actionStyle && pageState === 'active' ? (
      <div className={pad.cardSection}>
        <ProposalAcceptActions
          chosenOptionTitle={chosen?.title ?? null}
          totalLabel={totalLabel}
          expiresAt={proposal!.expires_at}
          onAccept={handleAccept}
          onDecline={handleDecline}
          actionLoading={actionLoading}
          actionError={actionError}
          brand={actionStyle.color}
          radius={actionStyle.radius}
          textColor={branding.textColor}
          mutedColor={branding.mutedColor}
          labels={{
            ...branding.labels,
            accept: actionStyle.primaryLabel || branding.labels.accept,
            decline: actionStyle.secondaryLabel || branding.labels.decline,
          }}
        />
      </div>
    ) : null;

  const core =
    proposal && branding ? (
      <div className={pad.cardSection}>
        <ProposalPageView
          variant="blockCore"
          coupleName={proposal.couple_name}
          proposalNumber={proposal.proposal_number}
          notes={proposal.notes}
          expiresAt={proposal.expires_at}
          options={proposal.options}
          state={pageState === 'accepted' ? 'accepted' : pageState === 'active' ? 'active' : 'expired'}
          branding={branding}
          chosenId={effectiveChosenId}
          selection={selection}
          onChoose={pageState === 'active' && !actionLoading ? handleChoose : undefined}
          onToggle={
            pageState === 'active' && !actionLoading
              ? (itemId, next) => setPicks({ ...selection, [itemId]: next })
              : undefined
          }
        />
      </div>
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
          useBlocks && doc ? (
            // Branded: the MC's block chrome around the fixed core.
            <div
              className="overflow-hidden"
              style={{ borderRadius: branding.radius }}
            >
              <PublicBlockRenderer blocks={preBlocks} branding={proposal} doc={doc} hideAction />
              {core}
              {betweenBlocks.length > 0 ? (
                <PublicBlockRenderer blocks={betweenBlocks} branding={proposal} doc={doc} hideAction />
              ) : null}
              {acceptBlock}
              {postBlocks.length > 0 ? (
                <PublicBlockRenderer blocks={postBlocks} branding={proposal} doc={doc} hideAction />
              ) : null}
            </div>
          ) : (
            // Fallback: the self-contained standalone layout.
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
          )
        ) : null}
      </div>
    </div>
  );
}

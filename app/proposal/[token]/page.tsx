/**
 * Public proposal page — orchestrator.
 *
 * Reached via the share-token capability URL (`/proposal/<token>`).
 * Loads `get_public_proposal(token)`, and while the proposal is
 * active lets the couple pick a package option (multi-option
 * proposals show the chooser; single-option skips it), adjust the
 * add-on ticks seeded from the MC's pre-ticks, and accept with a
 * two-step confirm — the acceptance carries the chosen option +
 * final selection to `accept_proposal`.
 *
 * Accepted proposals re-render read-only with the RECORDED choice
 * (`accepted_option_id` + `accepted_addon_selection`) so the page is
 * always the receipt of what was agreed.
 *
 * States: loading / not_found / active / expired / accepted /
 * declined. Scalar branding (colors, fonts, logo, density, radius)
 * applies; block-tree layouts are deferred for proposals — a block
 * tree can't express the option chooser.
 *
 * @module app/proposal/[token]/page
 */
'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import {
  bodyFontFamily,
  DENSITY_PAD,
  headingFontFamily,
  useBrandingHead,
} from '@/lib/branding/public-surface';
import { Html } from '@/lib/branding/public-blocks/html';
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

  const [proposal, setProposal] = useState<PublicProposal | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_public_proposal', {
      token: params.token,
    });
    if (error || !data) {
      setPageState('not_found');
      return;
    }
    const p = data as unknown as PublicProposal;
    const state = deriveState(p);
    setProposal(p);
    setPageState(state);

    if (state === 'accepted' && p.accepted_option_id) {
      // The receipt view: the recorded choice, never the live picks.
      setChosenId(p.accepted_option_id);
      setSelection(p.accepted_addon_selection ?? {});
    } else {
      // Single option: chosen implicitly. Multi: couple must pick.
      const only = p.options.length === 1 ? p.options[0] : null;
      setChosenId(only ? only.id : null);
      setSelection(only ? defaultSelection(only) : {});
    }
  }, [params.token, supabase]);

  useEffect(() => {
    void load();
  }, [load]);
  useBrandingHead(proposal);

  const chosen = proposal?.options.find((o) => o.id === chosenId) ?? null;

  const handleChoose = (optionId: string) => {
    const option = proposal?.options.find((o) => o.id === optionId);
    if (!option) return;
    setChosenId(optionId);
    setSelection(defaultSelection(option));
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
    if (res?.error) {
      if (res.error === 'expired') setPageState('expired');
      else if (res.error === 'already_actioned') await load();
      else setActionError('Something went wrong. Please try again.');
      return;
    }
    await load();
  };

  const handleDecline = async () => {
    setActionLoading(true);
    setActionError(null);
    const { data } = await supabase.rpc('decline_proposal', { token: params.token });
    setActionLoading(false);
    const res = data as { error?: string } | null;
    if (res?.error) {
      if (res.error === 'already_actioned') await load();
      else setActionError('Something went wrong. Please try again.');
      return;
    }
    await load();
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

  const showHeaderBanner =
    proposal?.header_image_url && pageState !== 'loading' && pageState !== 'not_found';

  const totalLabel = chosen ? formatCurrency(selectionTotal(chosen, selection)) : '';

  return (
    <div
      className={`min-h-screen ${pad.page} px-4`}
      style={{ background: pageBg, color: textColor, fontFamily: bodyStack }}
    >
      <div className="max-w-lg mx-auto">
        {showHeaderBanner ? (
          <div className="mb-5 overflow-hidden" style={{ borderRadius: radius }}>
            {/* User-uploaded brand asset — no next/image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={proposal!.header_image_url!}
              alt=""
              className="block w-full h-40 object-cover"
            />
          </div>
        ) : null}

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
          <div
            className="bg-surface shadow-sm border border-border overflow-hidden"
            style={{ borderRadius: radius }}
          >
            {/* Header */}
            <div className={`${pad.cardHeader} border-b border-border`}>
              {proposal.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={proposal.logo_url}
                  alt={htmlToPlainText(proposal.business_name) || 'Logo'}
                  className="max-h-12 object-contain mb-3"
                />
              ) : proposal.business_name ? (
                <p
                  className="text-xs font-medium uppercase tracking-wider mb-3"
                  style={{ color: mutedColor }}
                >
                  <Html value={proposal.business_name} allowLists={false} />
                </p>
              ) : null}
              <h1
                className="text-2xl mb-1"
                style={{ color: textColor, fontFamily: headingStack, fontWeight: headingWeight }}
              >
                {proposal.title}
              </h1>
              <p className="text-sm" style={{ color: mutedColor }}>
                {proposal.couple_name}
              </p>
              <div className="flex items-center gap-3 mt-3">
                <span className="text-xs" style={{ color: mutedColor }}>
                  {proposal.proposal_number}
                </span>
                {proposal.expires_at && pageState === 'active' ? (
                  <span className="text-xs" style={{ color: mutedColor }}>
                    Expires {formatDate(proposal.expires_at)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className={pad.cardSection}>
              {/* Multi-option chooser while active; the accepted view
                  pins to the recorded choice. */}
              {pageState === 'active' && proposal.options.length > 1 ? (
                <div className="mb-6">
                  <ProposalOptionChooser
                    options={proposal.options}
                    chosenId={chosenId}
                    onChoose={handleChoose}
                    disabled={actionLoading}
                    brand={brand}
                    textColor={textColor}
                    mutedColor={mutedColor}
                    radius={Math.min(radius, 12)}
                  />
                </div>
              ) : null}

              {chosen ? (
                <>
                  {pageState !== 'active' && proposal.options.length > 1 ? (
                    <p className="mb-3 text-xs" style={{ color: mutedColor }}>
                      {pageState === 'accepted' ? 'Chosen package: ' : 'Package: '}
                      <span className="font-medium" style={{ color: textColor }}>
                        {chosen.title}
                      </span>
                    </p>
                  ) : null}
                  <ProposalSelection
                    option={chosen}
                    selection={selection}
                    onToggle={(itemId, next) =>
                      setSelection((prev) => ({ ...prev, [itemId]: next }))
                    }
                    locked={pageState !== 'active' || actionLoading}
                    brand={brand}
                    textColor={textColor}
                    mutedColor={mutedColor}
                  />
                </>
              ) : (
                <p className="text-sm" style={{ color: mutedColor }}>
                  Select a package above to see what&apos;s included.
                </p>
              )}
            </div>

            {/* Notes */}
            {proposal.notes ? (
              <div className="px-8 pb-6">
                <p
                  className="text-xs font-medium uppercase tracking-wider mb-2"
                  style={{ color: mutedColor }}
                >
                  Notes
                </p>
                <p className="text-sm whitespace-pre-wrap" style={{ color: mutedColor }}>
                  {proposal.notes}
                </p>
              </div>
            ) : null}

            {pageState === 'active' ? (
              <ProposalAcceptActions
                chosenOptionTitle={chosen?.title ?? null}
                totalLabel={totalLabel}
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
          </div>
        ) : null}
      </div>
    </div>
  );
}

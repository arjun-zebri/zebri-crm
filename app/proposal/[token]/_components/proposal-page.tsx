'use client';

/**
 * The couple-facing proposal: the MC's `proposal` block tree in the page
 * frame with this proposal's data threaded through `doc.proposal`, plus the
 * selection state the packages and accept blocks share, and the accept /
 * decline dialogs. Used by the public token page (`frame="page"`), the
 * branding preview, and the print path (`frame="print"`).
 *
 * @module app/proposal/[token]/_components/proposal-page
 */
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import type { Block } from '@/app/(dashboard)/branding/blocks/types';
// print-proposal imports ProposalPage back from this module (the PDF is the
// same page in the print frame). The cycle is safe: both sides only touch
// the other inside function bodies, never at module evaluation.
import { printProposal } from '@/components/print/print-proposal';
import { layoutFontIds, pageSurfaceStyle, ProposalLayoutView, resolveTheme, type ButtonAction, type ProposalLayout } from '@/features/proposals';
import { resolveSelection } from '@/lib/branding/public-blocks/proposal/packages';
import { PublicBlockRenderer } from '@/lib/branding/public-renderer';
import { bodyFontFamily, useBrandingHead } from '@/lib/branding/public-surface';
import { deriveState, toPublicDoc, type PublicProposal } from '@/lib/proposals/public-types';

import { AcceptStepper } from './accept-stepper';
import { DeclineForm } from './decline-form';
import { emitEngagement } from './engagement-bus';
import { EngagementTracker } from './engagement-tracker';

/** Props for {@link ProposalPage}. */
export interface ProposalPageProps {
  proposal: PublicProposal;
  blocks: Block[];
  /**
   * The v2 layout (Proposal Layout v2, Phase 1). When present it replaces
   * the v1 `blocks` tree; `blocks` is still required so the print path and
   * older callers keep one signature until Phase 5 drops v1.
   */
  layout?: ProposalLayout | null | undefined;
  frame: 'page' | 'print';
  /** The share token, for the accept/decline dialogs' requests. Undefined on the print frame, which never opens them. */
  token?: string | undefined;
  /** Client-only print callback; the server page cannot pass a function, so this is undefined there and supplied by {@link ProposalPageClient}. */
  onDownloadPdf?: (() => void) | undefined;
  /**
   * Called once a decline succeeds, so the client wrapper can
   * `router.refresh()`. A plain callback (not `useRouter` called in here
   * directly) because the print frame renders this component through
   * `renderToStaticMarkup`, outside any Next.js router context.
   */
  onDeclined?: (() => void) | undefined;
  /**
   * True when mounted inside another surface's own chrome (the proposal
   * builder's in-modal preview). Suppresses the branded favicon swap so the
   * host app's tab icon is untouched; branded fonts still load. Defaults to
   * false, so the public token page and /branding/preview are unaffected.
   */
  embedded?: boolean | undefined;
}

/** See {@link ProposalPageProps}. */
export function ProposalPage({ proposal, blocks, layout, frame, token, onDownloadPdf, onDeclined, embedded = false }: ProposalPageProps) {
  const doc = toPublicDoc(proposal);
  const initial = resolveSelection(doc.proposal!, undefined);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(initial.optionId);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>(initial.addonIds);
  // A reload mid-flow (the couple reopens the email link, or comes back
  // from a payment redirect) should land straight back on the stepper
  // rather than the static page, since 'active' is the only state where
  // starting closed makes sense.
  const [acceptOpen, setAcceptOpen] = useState(() => {
    const state = deriveState(proposal);
    return state === 'signing' || state === 'paying';
  });
  const [declineOpen, setDeclineOpen] = useState(false);
  // A v2 layout can use any catalogue font, not just Branding's heading +
  // body pair, so name every face it draws with or the couple's page (and
  // the PDF, which copies these stylesheets) falls back to a generic one.
  const layoutFonts = useMemo(() => (layout ? layoutFontIds(layout, proposal) : []), [layout, proposal]);
  useBrandingHead(frame === 'page' ? proposal : null, { favicon: !embedded, fonts: layoutFonts });

  const selectOption = (id: string) => {
    setSelectedOptionId(id);
    // Switching packages resets add-ons to that package's defaults: the ids
    // belong to the option, so a stale selection would never match anyway.
    const next = doc.proposal!.options.find((o) => o.id === id);
    setSelectedAddonIds((next?.items ?? []).filter((i) => i.is_addon && i.default_included).map((i) => i.id));
    emitEngagement({ type: 'package_selected', payload: { optionId: id } });
  };
  const toggleAddon = (id: string) => {
    const on = !selectedAddonIds.includes(id);
    setSelectedAddonIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    emitEngagement({ type: 'addon_toggled', payload: { itemId: id, on } });
  };

  // Rich-doc buttons inside a v2 layout report their intent through one
  // callback rather than a bespoke prop per action, so new button kinds
  // (Phase 2+) need only a new branch here, not a new ProposalPage prop.
  const onLayoutAction = (action: ButtonAction) => {
    if (action.kind === 'accept') setAcceptOpen(true);
    else if (action.kind === 'decline' && frame === 'page') setDeclineOpen(true);
    else if (action.kind === 'jump') {
      // `CSS.escape` is missing in some test environments; fall back to a
      // best-effort quote-strip so a jump button never throws in jsdom.
      const esc = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(action.sectionId) : action.sectionId.replace(/"/g, '');
      document.querySelector(`[data-section-id="${esc}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    // A v2 layout's page colour comes from its canvas theme; the legacy
    // block tree has no theme and keeps Branding's page background.
    <div
      className="min-h-screen @container/doc"
      style={layout ? pageSurfaceStyle(resolveTheme(layout, proposal), proposal) : { background: proposal.page_background, color: proposal.text_color, fontFamily: bodyFontFamily(proposal) }}
    >
      {layout ? (
        <ProposalLayoutView
          layout={layout}
          branding={proposal}
          doc={doc}
          mode={frame}
          onAction={onLayoutAction}
          proposal={{
            selectedOptionId,
            selectedAddonIds,
            onSelectOption: selectOption,
            onToggleAddon: toggleAddon,
            onAccept: () => setAcceptOpen(true),
            onDecline: frame === 'page' ? () => setDeclineOpen(true) : undefined,
          }}
        />
      ) : (
        <PublicBlockRenderer
          blocks={blocks}
          branding={proposal}
          doc={doc}
          frame={frame}
          hideAction
          proposal={{
            selectedOptionId,
            selectedAddonIds,
            onSelectOption: selectOption,
            onToggleAddon: toggleAddon,
            onAccept: () => setAcceptOpen(true),
            onDecline: frame === 'page' ? () => setDeclineOpen(true) : undefined,
          }}
        />
      )}
      {/* m6: `enabled` is a real, checkable guard here -- print and the
          branding preview both reach this with no `token`, so it is
          genuinely false for them rather than a tautology. */}
      <EngagementTracker token={token ?? ''} enabled={frame === 'page' && Boolean(token)} />
      {frame === 'page' && token ? (
        <>
          <AcceptStepper
            open={acceptOpen}
            onClose={() => setAcceptOpen(false)}
            token={token}
            proposal={proposal}
            selectedOptionId={selectedOptionId}
            selectedAddonIds={selectedAddonIds}
            onSelectOption={selectOption}
            onToggleAddon={toggleAddon}
            onDownloadPdf={onDownloadPdf}
          />
          <DeclineForm
            open={declineOpen}
            onClose={() => setDeclineOpen(false)}
            token={token}
            branding={proposal}
            onDeclined={() => {
              setDeclineOpen(false);
              onDeclined?.();
            }}
          />
        </>
      ) : null}
    </div>
  );
}

/**
 * Client wrapper mounted by the public token page (a server component).
 * Supplies the print callback and the post-decline refresh: a server
 * component can load and pass the `proposal`/`blocks` data, but never a
 * function, so both live in this client boundary instead.
 */
export function ProposalPageClient({ proposal, blocks, layout, token }: { proposal: PublicProposal; blocks: Block[]; layout?: ProposalLayout | null; token: string }) {
  const router = useRouter();
  return (
    <ProposalPage
      proposal={proposal}
      blocks={blocks}
      layout={layout}
      frame="page"
      token={token}
      onDownloadPdf={() => printProposal(proposal, blocks, layout)}
      onDeclined={() => router.refresh()}
    />
  );
}

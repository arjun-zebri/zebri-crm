/**
 * Right-pane preview for the proposal builder modal.
 *
 * Unlike the invoice/contract builder's `BuilderPreviewPane` (three tabs:
 * PDF, email, payment page), a proposal has one couple-facing surface, so
 * this pane renders it directly: the MC's actual branding + saved
 * `proposal` block tree, filled with the form's live (possibly unsaved)
 * state via `previewProposal`. This is the fix for the builder having no
 * preview at all before send, when a draft's dead share link
 * (`share_token_enabled` defaults to false) left the MC unable to see what
 * the couple will get.
 *
 * Includes the same "Branded as {Business Name} · Update branding ↗"
 * header the invoice/contract pane uses, opening `/branding` in a new tab
 * so the MC doesn't lose the modal.
 *
 * Renders `ProposalPage` with no `token` and `embedded`, which keeps the
 * accept stepper and decline form unmounted (both are gated on a token) and
 * suppresses the branded favicon swap (see `useBrandingHead`), so the
 * preview is inert and never touches the dashboard's own tab icon.
 *
 * @module components/builders/parts/proposal-preview-pane
 */
'use client';

import { ExternalLink, Palette } from 'lucide-react';

import { ProposalPage } from '@/app/proposal/[token]/_components/proposal-page';
import { Loading } from '@/components/ui/loading';
import type { ProposalLayout } from '@/features/proposals';
import { useCurrentBranding } from '@/lib/branding/use-current-branding';
import type { ProposalFormState } from '@/lib/proposals/form-mapping';
import { previewProposal } from '@/lib/proposals/preview-proposal';

export interface ProposalPreviewPaneProps {
  /** The builder's live form state, mapped straight into the preview. */
  form: ProposalFormState;
  /** The selected couple's display name, or null when none is chosen yet. */
  coupleName: string | null;
  /**
   * The proposal's own Layout v2 design, when it has one. Passing it makes
   * this pane show the document the couple actually receives; without it
   * the pane would render the legacy block tree, which for such a proposal
   * is a page nobody will ever see. The design itself is edited at
   * `/proposals/[id]/design`, not here.
   */
  layout?: ProposalLayout | null | undefined;
}

export function ProposalPreviewPane({ form, coupleName, layout }: ProposalPreviewPaneProps) {
  const { branding, blocks, brandLabel, loading } = useCurrentBranding('proposal');

  return (
    <div className="flex h-full flex-col gap-3 rounded-control bg-surface-muted/60 p-4 sm:p-5">
      <h2 className="text-section font-semibold text-text">Preview</h2>

      {/* Branded-as line, matching the invoice/contract preview pane. */}
      <div className="flex items-center justify-between gap-2 text-body text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Palette size={12} strokeWidth={1.5} className="text-text-subtle" />
          {brandLabel ? (
            <>
              Branded as <span className="text-text">{brandLabel}</span>
            </>
          ) : (
            <span className="italic">Using default branding</span>
          )}
        </span>
        <a
          href="/branding"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-text-muted hover:text-text transition-colors"
        >
          Update branding
          <ExternalLink size={11} strokeWidth={1.5} />
        </a>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto rounded-control border border-border">
        {loading || !branding ? (
          <Loading label="Loading preview" />
        ) : (
          <ProposalPage
            proposal={previewProposal(form, branding, coupleName)}
            blocks={blocks}
            layout={layout ?? null}
            frame="page"
            embedded
          />
        )}
      </div>
    </div>
  );
}

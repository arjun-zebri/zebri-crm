'use client';

/**
 * The body of the Send a proposal modal: the couple's page, rendered from
 * the chosen template exactly as they will open it.
 *
 * Same renderer, same mode and the same `defaultSelection={false}` the
 * template editor's Preview overlay uses, so there is one definition of
 * "what the couple sees" and the modal cannot drift from the real page.
 * Everything it shows comes from the template; only the couple's name,
 * date, venue and the expiry are filled in from the row above.
 *
 * @module components/builders/parts/send-proposal-preview
 */
import { FileHeart } from 'lucide-react';
import Link from 'next/link';

import { Empty } from '@/components/ui/empty';
import { ErrorState } from '@/components/ui/error-state';
import { Loading } from '@/components/ui/loading';
import { pageSurfaceStyle, ProposalLayoutView, resolveTheme, type TemplateListItem } from '@/features/proposals';
import type { PublicBranding } from '@/lib/branding/public-branding';
import { templatePreviewDoc } from '@/lib/proposals/template-preview-doc';

/** Props for {@link SendProposalPreview}. */
export interface SendProposalPreviewProps {
  /** The template to render, or null once loading finished and there were none. */
  template: TemplateListItem | null;
  /** The MC's resolved branding; null while it is still loading. */
  branding: PublicBranding | null;
  /** True while the templates or the branding are still loading. */
  loading: boolean;
  /** Set when the templates list failed to load. */
  error: Error | null;
  onRetry: () => void;
  coupleName: string | null;
  eventDate: string | null;
  venue: string | null;
  expiresAt: string | null;
  /** The deposit the proposal would be created with, for the `deposit_percent` variable. */
  depositPercent: number | null;
}

/** See {@link SendProposalPreviewProps}. */
export function SendProposalPreview({
  template,
  branding,
  loading,
  error,
  onRetry,
  coupleName,
  eventDate,
  venue,
  expiresAt,
  depositPercent,
}: SendProposalPreviewProps) {
  if (error) {
    return <ErrorState title="Could not load your proposal templates" error={error} onRetry={onRetry} />;
  }
  if (loading || !branding) {
    return <Loading label="Loading the preview" />;
  }
  if (!template) {
    return (
      <Empty
        icon={FileHeart}
        title="Create a proposal template first"
        description="A proposal is a copy of one of your templates, so there has to be one to send."
        action={
          <Link
            href="/proposals"
            className="text-body font-medium text-text underline underline-offset-2 hover:text-text-muted"
          >
            Go to Proposals
          </Link>
        }
      />
    );
  }

  const theme = resolveTheme(template.layout, branding);
  const doc = templatePreviewDoc({
    layout: template.layout,
    templateName: template.name,
    branding,
    coupleName,
    eventDate,
    venue,
    expiresAt,
    depositPercent,
  });

  return (
    // Full-bleed: the page is the content of this modal, not a framed
    // picture sitting inside it, so it runs to the modal's own edges
    // rather than adding a second border around one that already exists.
    <div className="-mx-4 -mb-4 sm:-mx-6">
      {/*
        The sheet repeats the page background/text/font `ProposalLayoutView`
        already paints on its own root - the same duplication
        `preview-overlay.tsx` and `proposal-page.tsx` carry, and for the same
        reason: a layout shorter than this box would otherwise show the
        modal's surface colour under it instead of the page's. The values are
        the MC's own brand colours and fonts, so they can only be an inline
        style.
      */}
      <div style={pageSurfaceStyle(theme, branding)}>
        <ProposalLayoutView layout={template.layout} branding={branding} doc={doc} mode="page" defaultSelection={false} />
      </div>
    </div>
  );
}

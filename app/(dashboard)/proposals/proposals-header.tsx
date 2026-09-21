/**
 * /proposals header: title + the New split button. No count and no search
 * box (2026-09-19 feedback): both existed only for the per-proposal list
 * this page no longer shows - see `page.tsx`'s module doc.
 *
 * @module app/(dashboard)/proposals/proposals-header
 */
'use client';

import { Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';

import { NewProposalMenu } from './new-proposal-menu';

export interface ProposalsHeaderProps {
  onNew: () => void;
  /** Opens the New template flow. Omitted while Proposal Layout v2 is off. */
  onNewTemplate?: () => void;
  /** Opens the proposal settings modal. Omitted while Proposal Layout v2 is off. */
  onOpenSettings?: () => void;
}

/** See {@link ProposalsHeaderProps}. */
export function ProposalsHeader({ onNew, onNewTemplate, onOpenSettings }: ProposalsHeaderProps) {
  return (
    <PageHeader
      title="Proposals"
      actions={
        <div className="flex items-center gap-2">
          {onOpenSettings ? (
            // `aria-label` keeps the accessible name stable across
            // breakpoints: the visible label collapses to icon-only below
            // `sm` (`hidden sm:inline`), which would otherwise drop it
            // from the accessible name on mobile and break any
            // getByRole lookup there.
            <Button variant="outline" onClick={onOpenSettings} className="gap-1.5" aria-label="Proposal settings">
              <Settings size={16} strokeWidth={1.5} />
              <span className="hidden sm:inline" aria-hidden="true">Settings</span>
            </Button>
          ) : null}
          {/* Conditional spread (exactOptionalPropertyTypes): `onNewTemplate` is
              optional here, so an explicit `undefined` value must not be
              passed through as a present key. */}
          <NewProposalMenu onNewProposal={onNew} {...(onNewTemplate ? { onNewTemplate } : {})} />
        </div>
      }
    />
  );
}

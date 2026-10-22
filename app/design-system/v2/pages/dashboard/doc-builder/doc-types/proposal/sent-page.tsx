'use client';

import { SAMPLE_PROPOSAL_DOC } from '@/lib/proposals/sample-proposal';

import { CouplePage } from '../../render/couple-page';

import type { ComposedPage } from './composed';

/**
 * A sent proposal's page, as the couple has it: the frozen layout in the
 * frozen branding, with the booking terms it went out with. Nothing here
 * reads the brand kit, so changing the kit later leaves it as sent.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/proposal/sent-page
 */

export interface SentPageProps {
  page: ComposedPage;
  couple: string;
  venue: string;
  className?: string | undefined;
}

/** The sent page. See {@link SentPageProps}. */
export function SentPage({ page, couple, venue, className = '' }: SentPageProps) {
  const doc = { ...SAMPLE_PROPOSAL_DOC, coupleName: couple, venue, title: `${couple}, your wedding` };
  return (
    <div className={`overflow-hidden rounded-panel shadow-lg ring-1 ring-hairline ${className}`}>
      <CouplePage layout={page.layout} branding={page.branding} doc={doc} terms={page.terms} mode="print" />
    </div>
  );
}

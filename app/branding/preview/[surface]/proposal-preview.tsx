/**
 * The proposal surface preview: the page frame with the sample proposal.
 *
 * Unlike the invoice/contract/portal previews (a document card floating on
 * a grey canvas), the proposal surface owns its own full-page background
 * and text colour via the `page` frame, so there is no `DOC_CANVAS_BG`
 * wrapper here. Renders through `ProposalPage`, same as the public token
 * page, so package selection and the accept note behave identically here.
 *
 * @module app/branding/preview/[surface]/proposal-preview
 */
'use client'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { ProposalPage } from '@/app/proposal/[token]/_components/proposal-page'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { sampleProposal } from '@/lib/proposals/sample-proposal'

/** Props for {@link ProposalPreview}. */
interface ProposalPreviewProps {
  branding: PublicBranding
  blocks: Block[]
}

/** Renders the saved proposal block tree, framed as a full page, with the
 *  deterministic sample proposal so the MC can see it fully populated. */
export function ProposalPreview({ branding, blocks }: ProposalPreviewProps) {
  return <ProposalPage proposal={sampleProposal(branding)} blocks={blocks} frame="page" />
}

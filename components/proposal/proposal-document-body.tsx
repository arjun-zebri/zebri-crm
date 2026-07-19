/**
 * The proposal document interior — the block chrome wrapped around the
 * fixed core — shared by the public page and the composer preview so
 * the two can never drift.
 *
 * The couple's page and the composer preview used to render the couple
 * page two different ways: the public page block-renders the MC's saved
 * tree (header banner, custom text, styled Accept action, footer/ABN)
 * around the fixed `proposalBody` core, while the composer preview drew
 * the older self-contained `standalone` layout with a generic CTA. An MC
 * who customised their proposal blocks therefore previewed something the
 * couple never received. This component is the single split-at-marker
 * renderer both now use.
 *
 * Split model (same as the public invoice/contract pages): everything
 * before the `proposalBody` marker is pre-chrome, the marker is replaced
 * by the fixed core, and the remainder splits at the `action` block into
 * "between" chrome, the accept slot, and "post" chrome (footer). The
 * accept UI itself differs per caller (interactive accept/decline vs a
 * static preview CTA), so it comes in through {@link renderAccept}.
 *
 * @module components/proposal/proposal-document-body
 */
'use client'

import type { ReactNode } from 'react'

// The block tree type lives under the editor surface; consuming it here
// is the same bridge `lib/branding/public-renderer` already makes.
import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import {
  ProposalPageView,
  viewBranding,
} from '@/components/proposal/proposal-page-view'
import { DENSITY_PADDING as DENSITY_PAD } from '@/lib/branding/density'
import type { PublicBranding } from '@/lib/branding/public-branding'
import { findActionStyle, PublicBlockRenderer } from '@/lib/branding/public-renderer'
import type {
  ProposalViewBranding,
  PublicProposalOption,
} from '@/lib/payments/proposal-view'

/** The action block's resolved button styling + wording. */
export interface ProposalActionStyle {
  color: string
  radius: number
  primaryLabel?: string
  secondaryLabel?: string | null
}

export interface ProposalDocumentBodyProps {
  /** Saved block tree for the proposal surface; null/empty falls back
   *  to the self-contained standalone layout. */
  blocks: Block[] | null | undefined
  /** Raw resolved branding payload (RPC row or `buildPublicBranding`). */
  branding: PublicBranding
  /** Proposal title, used by any `title` block in the tree. */
  title: string
  coupleName: string
  proposalNumber: string
  notes: string | null
  expiresAt: string | null
  options: PublicProposalOption[]
  /** Drives the core's affordances. The composer preview passes 'active'. */
  state: 'active' | 'accepted' | 'declined' | 'expired'
  chosenId: string | null
  selection: Record<string, boolean>
  /** Interactive handlers — omit for a read-only preview. */
  onChoose?: ((optionId: string) => void) | undefined
  onToggle?: ((itemId: string, next: boolean) => void) | undefined
  /**
   * Renders the accept/decline UI, styled from the action block. Called
   * only while `state === 'active'`; return the caller's own CTA (the
   * public page's interactive accept, or the preview's static CTA).
   */
  renderAccept?:
    | ((ctx: { style: ProposalActionStyle; view: ProposalViewBranding; publicBranding: PublicBranding }) => ReactNode)
    | undefined
}

/**
 * Render the proposal document body — block chrome + fixed core + accept
 * slot when a tree exists, else the standalone fallback.
 */
export function ProposalDocumentBody({
  blocks,
  branding,
  title,
  coupleName,
  proposalNumber,
  notes,
  expiresAt,
  options,
  state,
  chosenId,
  selection,
  onChoose,
  onToggle,
  renderAccept,
}: ProposalDocumentBodyProps) {
  const view = viewBranding(branding)
  const pad = DENSITY_PAD[branding.density]

  const list = blocks ?? null
  const pbIdx = list?.findIndex((b) => b.type === 'proposalBody') ?? -1
  const useBlocks = !!list && list.length > 0 && pbIdx >= 0

  const actionStyle = findActionStyle(list, {
    brandColor: view.brand,
    cornerRadius: view.radius,
  })
  // The accept slot only shows on an active proposal; the accepted /
  // expired / declined views pin to the recorded state with no CTA.
  const accept =
    state === 'active' ? renderAccept?.({ style: actionStyle, view, publicBranding: branding }) ?? null : null

  const core = (
    <ProposalPageView
      variant="blockCore"
      coupleName={coupleName}
      proposalNumber={proposalNumber}
      notes={notes}
      expiresAt={expiresAt}
      options={options}
      // Declined has no distinct core layout; it reads like expired.
      state={state === 'accepted' ? 'accepted' : state === 'active' ? 'active' : 'expired'}
      publicBranding={branding}
      branding={view}
      chosenId={chosenId}
      selection={selection}
      onChoose={onChoose}
      onToggle={onToggle}
    />
  )

  if (useBlocks) {
    const preBlocks = list!.slice(0, pbIdx)
    const rest = list!.slice(pbIdx + 1)
    const actIdx = rest.findIndex((b) => b.type === 'action')
    const betweenBlocks = actIdx >= 0 ? rest.slice(0, actIdx) : rest
    const postBlocks = actIdx >= 0 ? rest.slice(actIdx + 1) : []
    const doc = {
      title,
      refNumber: proposalNumber,
      expiresAt,
      items: [],
      subtotal: 0,
      taxRate: 0,
    }

    return (
      <div className="overflow-hidden" style={{ borderRadius: view.radius }}>
        <PublicBlockRenderer blocks={preBlocks} branding={branding} doc={doc} hideAction />
        <div className={pad.cardSection}>{core}</div>
        {betweenBlocks.length > 0 ? (
          <PublicBlockRenderer blocks={betweenBlocks} branding={branding} doc={doc} hideAction />
        ) : null}
        {accept ? <div className={pad.cardSection}>{accept}</div> : null}
        {postBlocks.length > 0 ? (
          <PublicBlockRenderer blocks={postBlocks} branding={branding} doc={doc} hideAction />
        ) : null}
      </div>
    )
  }

  // Fallback: the self-contained standalone layout (no saved blocks, or
  // the block migration hasn't reached the DB yet).
  return (
    <ProposalPageView
      coupleName={coupleName}
      proposalNumber={proposalNumber}
      notes={notes}
      expiresAt={expiresAt}
      options={options}
      state={state}
      publicBranding={branding}
      branding={view}
      chosenId={chosenId}
      selection={selection}
      onChoose={onChoose}
      onToggle={onToggle}
      actions={accept}
    />
  )
}

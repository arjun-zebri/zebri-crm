/**
 * The proposal document interior — renders either a full block tree via
 * {@link ProposalBlocksRenderer} when package blocks are present, or
 * falls back to a self-contained {@link ProposalPageView} when no blocks
 * exist.
 *
 * When the proposal tree contains package blocks (packageHeader,
 * packageDetails, packageInclusions, packageTotals), the entire tree is
 * delegated to ProposalBlocksRenderer, which handles routing of proposal-
 * specific blocks and generic block rendering. When blocks are empty or
 * undefined, the fallback renders the self-contained standalone layout.
 *
 * The accept UI itself differs per caller (interactive accept/decline vs
 * a static preview CTA), so it comes in through {@link renderAccept}.
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
import { ProposalBlocksRenderer, type AcceptStyle } from '@/components/proposal/proposal-blocks-renderer'
import type { PublicBranding } from '@/lib/branding/public-branding'
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
  /** Block path — accepted view: the recorded option, so only it renders. */
  acceptedOptionId?: string | null
  /** Block path — accepted view: the recorded add-on selection. */
  acceptedSelection?: Record<string, boolean> | undefined
  /** Block path: render the per-package Accept CTA with its live selection. */
  renderPackageAccept?: (ctx: {
    option: PublicProposalOption
    selection: Record<string, boolean>
    style: AcceptStyle
  }) => ReactNode
  /** Block path: render the single Decline at the bottom of the stack. */
  renderDecline?: (ctx: { style: AcceptStyle }) => ReactNode
}

/**
 * Render the proposal document body — routes to ProposalBlocksRenderer
 * when package blocks are present, else falls back to the self-contained
 * standalone layout.
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
  acceptedOptionId,
  acceptedSelection,
  renderPackageAccept,
  renderDecline,
}: ProposalDocumentBodyProps) {
  const view = viewBranding(branding)

  const list = blocks ?? null
  // Detect if blocks contain any package-specific block types
  const hasPackageBlocks =
    !!list && list.length > 0 && list.some((b) =>
      ['packageHeader', 'packageDetails', 'packageInclusions', 'packageTotals'].includes(b.type)
    )

  // The accept slot only shows on an active proposal; the accepted /
  // expired / declined views pin to the recorded state with no CTA.
  const accept =
    state === 'active' ? renderAccept?.({ style: { color: view.brand, radius: view.cornerRadius }, view, publicBranding: branding }) ?? null : null

  // When package blocks are present, render the tree via ProposalBlocksRenderer,
  // which stacks a package per option, each with its own Accept.
  if (hasPackageBlocks) {
    return (
      <ProposalBlocksRenderer
        blocks={list!}
        branding={branding}
        view={view}
        options={options}
        state={state}
        expiresAt={expiresAt}
        acceptedOptionId={acceptedOptionId}
        acceptedSelection={acceptedSelection}
        renderPackageAccept={renderPackageAccept}
        renderDecline={renderDecline}
      />
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

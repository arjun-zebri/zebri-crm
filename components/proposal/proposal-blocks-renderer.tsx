/**
 * Renders a proposal block tree, substituting proposal-specific blocks
 * with their implementations and delegating other block types to the
 * generic {@link PublicBlockRenderer}.
 *
 * All proposal blocks share state via {@link ProposalBlockContext} so
 * the option chooser, add-on selection, and price summary stay in sync.
 *
 * @module components/proposal/proposal-blocks-renderer
 */
'use client'

import { ReactNode } from 'react'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { PublicBlockRenderer } from '@/lib/branding/public-renderer'
import type { PublicBranding } from '@/lib/branding/public-branding'
import type { ProposalViewBranding, PublicProposalOption } from '@/lib/payments/proposal-view'

import { ProposalBlockProvider } from './proposal-block-context'
import { PackageDetails } from './package-details'
import { PackageHeader } from './package-header'
import { PackageInclusions } from './package-inclusions'
import { PackageTotals } from './package-totals'

/**
 * Props for the proposal block renderer.
 */
export interface ProposalBlocksRendererProps {
  /** The proposal's block tree. */
  blocks: Block[]
  /** Raw resolved branding payload. */
  branding: PublicBranding
  /** Proposal view branding (resolved scalar values). */
  view: ProposalViewBranding
  /** Available package options. */
  options: PublicProposalOption[]
  /** ID of the currently chosen option. */
  chosenId: string
  /** Add-on selection state: itemId -> boolean. */
  selection: Record<string, boolean>
  /** Proposal state: controls affordances. */
  state: 'active' | 'accepted' | 'declined' | 'expired'
  /** Expiry timestamp if known. */
  expiresAt: string | null
  /** Called when the couple chooses a different package. */
  onChoose?: (optionId: string) => void
  /** Called when the couple toggles an add-on. */
  onToggle?: (itemId: string, next: boolean) => void
  /**
   * Renders the accept/decline CTA. Called with the action block's
   * styling. Omit to render a static preview.
   */
  renderAccept?: (ctx: {
    style: { color: string; radius: number; primaryLabel?: string; secondaryLabel?: string | null }
    view: ProposalViewBranding
    publicBranding: PublicBranding
  }) => ReactNode
}

/**
 * Renders a proposal block tree, substituting proposal-specific blocks
 * with their implementations and delegating non-proposal blocks to the
 * generic renderer.
 *
 * Wraps all blocks in the proposal block context so package-specific
 * blocks can access the shared state.
 */
export function ProposalBlocksRenderer({
  blocks,
  branding,
  view,
  options,
  chosenId,
  selection,
  state,
  expiresAt,
  onChoose,
  onToggle,
  renderAccept,
}: ProposalBlocksRendererProps) {
  if (options.length === 0) return null

  const contextValue = {
    options,
    chosenId,
    selection,
    onChoose,
    onToggle,
    branding,
    view,
    expiresAt,
    state,
  }

  return (
    <ProposalBlockProvider value={contextValue}>
      <div className="space-y-6">
        {blocks.map((block) => (
          <BlockSwitch key={block.id} block={block} branding={branding} view={view} renderAccept={renderAccept} />
        ))}
      </div>
    </ProposalBlockProvider>
  )
}

interface BlockSwitchProps {
  block: Block
  branding: PublicBranding
  view: ProposalViewBranding
  renderAccept?: (ctx: {
    style: { color: string; radius: number; primaryLabel?: string; secondaryLabel?: string | null }
    view: ProposalViewBranding
    publicBranding: PublicBranding
  }) => ReactNode
}

function BlockSwitch({ block, branding, view, renderAccept }: BlockSwitchProps) {
  switch (block.type) {
    case 'packageHeader':
      return <PackageHeader block={block} />
    case 'packageDetails':
      return <PackageDetails block={block} />
    case 'packageInclusions':
      return <PackageInclusions block={block} />
    case 'packageTotals':
      return <PackageTotals block={block} />
    case 'action':
      if (renderAccept) {
        return (
          <>
            {renderAccept({
              style: {
                color: block.buttonColor ?? view.brand,
                radius: block.buttonRadius ?? view.cornerRadius,
                primaryLabel: block.primary,
                secondaryLabel: block.secondary,
              },
              view,
              publicBranding: branding,
            })}
          </>
        )
      }
      // Fallback: render static preview via PublicBlockRenderer
      return (
        <PublicBlockRenderer
          blocks={[block]}
          branding={branding}
          doc={{
            title: '',
            refNumber: '',
            expiresAt: null,
            items: [],
            subtotal: 0,
            taxRate: 0,
          }}
          hideAction
        />
      )
    default:
      // Delegate non-proposal blocks to PublicBlockRenderer
      return (
        <PublicBlockRenderer
          blocks={[block]}
          branding={branding}
          doc={{
            title: '',
            refNumber: '',
            expiresAt: null,
            items: [],
            subtotal: 0,
            taxRate: 0,
          }}
          hideAction
        />
      )
  }
}

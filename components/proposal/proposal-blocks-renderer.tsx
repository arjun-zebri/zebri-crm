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
import type { ProposalLabelEdit } from '@/lib/branding/proposal-labels'
import { pad } from '@/lib/branding/public-blocks/shared'
import type { PublicBranding } from '@/lib/branding/public-branding'
import { BlockOuter, PublicBlockRenderer } from '@/lib/branding/public-renderer'
import type { ProposalViewBranding, PublicProposalOption } from '@/lib/payments/proposal-view'

import { ProposalOptionChooser } from './option-chooser'
import { ProposalSelection } from './option-selection'
import { PackageDetails } from './package-details'
import { PackageHeader } from './package-header'
import { PackageInclusions } from './package-inclusions'
import { PackageTotals } from './package-totals'
import { ProposalBlockProvider, useProposalBlock } from './proposal-block-context'

/** The package-specific block types that make up the switchable package region. */
const PACKAGE_TYPES: ReadonlySet<Block['type']> = new Set([
  'packageHeader',
  'packageDetails',
  'packageInclusions',
  'packageTotals',
])

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
  /** Editor-only: commit an inline edit of a multi-package wording label. */
  onEditLabel?: ProposalLabelEdit
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
  onEditLabel,
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
    onEditLabel,
  }

  // Multi-package proposals replace the four single-package blocks with one
  // compare-and-pick region; single-package proposals render the blocks as-is.
  const isMulti = options.length > 1
  const visible = blocks.filter((block) => !block.hidden)
  const firstPackageIdx = visible.findIndex((b) => PACKAGE_TYPES.has(b.type))

  // No wrapper spacing: horizontal document padding comes from BlockOuter and
  // vertical rhythm from each block's `blockY`, exactly like the invoice tree,
  // so the padding is uniform across all documents.
  return (
    <ProposalBlockProvider value={contextValue}>
      <div>
        {visible.map((block, i) => {
          // In multi mode the package region is rendered once, at the position
          // of the first package block; the other package blocks are skipped.
          if (isMulti && PACKAGE_TYPES.has(block.type)) {
            return i === firstPackageIdx ? <MultiPackageRegion key="package-region" /> : null
          }
          return (
            <BlockSwitch key={block.id} block={block} branding={branding} view={view} renderAccept={renderAccept} />
          )
        })}
      </div>
    </ProposalBlockProvider>
  )
}

/**
 * The multi-package region: the compare-and-pick experience that stands in for
 * the single-package blocks when a proposal offers more than one option. It
 * reuses the standalone chooser (comparison cards) + selection (the chosen
 * package's add-ons and live total), styled from the MC's branding, and takes
 * the single shared horizontal document padding like every other block.
 */
function MultiPackageRegion() {
  const { options, chosenId, selection, onChoose, onToggle, view, branding, state, onEditLabel } =
    useProposalBlock()
  const chosen = options.find((o) => o.id === chosenId) ?? options[0] ?? null
  const p = pad(branding)

  return (
    <div className={`${p.docX} ${p.blockY} space-y-8`}>
      {state === 'active' && options.length > 1 ? (
        <ProposalOptionChooser
          options={options}
          chosenId={chosen?.id ?? null}
          onChoose={onChoose}
          disabled={!onChoose}
          branding={view}
          publicBranding={branding}
          onEditLabel={onEditLabel}
        />
      ) : null}
      {chosen ? (
        <ProposalSelection
          option={chosen}
          selection={selection}
          onToggle={onToggle}
          locked={!onToggle}
          heading={view.labels.selected.text}
          headingLabel={view.labels.selected}
          headingKey="selected"
          branding={view}
          publicBranding={branding}
          onEditLabel={onEditLabel}
        />
      ) : null}
    </div>
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
    // Package-specific blocks are routed through BlockOuter (the same wrapper
    // PublicBlockRenderer applies to every other block) so per-block padding,
    // background, border, and spacing overrides work identically here.
    case 'packageHeader':
      return (
        <BlockOuter block={block} branding={branding}>
          <PackageHeader block={block} />
        </BlockOuter>
      )
    case 'packageDetails':
      return (
        <BlockOuter block={block} branding={branding}>
          <PackageDetails block={block} />
        </BlockOuter>
      )
    case 'packageInclusions':
      return (
        <BlockOuter block={block} branding={branding}>
          <PackageInclusions block={block} />
        </BlockOuter>
      )
    case 'packageTotals':
      return (
        <BlockOuter block={block} branding={branding}>
          <PackageTotals block={block} />
        </BlockOuter>
      )
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

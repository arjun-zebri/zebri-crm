/**
 * Renders a proposal block tree.
 *
 * Chrome blocks (business name, notes, footer, dividers, images) render once in
 * place via the generic {@link PublicBlockRenderer}. The package region (the
 * `packageHeader/Details/Inclusions/Totals` blocks) plus the action block are
 * consumed by the package stack: one package renders the region once; several
 * packages render it once **per package**, stacked, each with its own Accept.
 * A single Decline sits at the bottom of the stack.
 *
 * Each stacked package keeps its own add-on selection locally, so a couple can
 * tick extras on the package they want before accepting it.
 *
 * @module components/proposal/proposal-blocks-renderer
 */
'use client'

import { ReactNode, useState } from 'react'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { getTextColor } from '@/lib/branding/contrast'
import { pad } from '@/lib/branding/public-blocks/shared'
import type { PublicBranding } from '@/lib/branding/public-branding'
import { PublicBlockRenderer, BlockOuter } from '@/lib/branding/public-renderer'
import {
  defaultSelection,
  type ProposalViewBranding,
  type PublicProposalOption,
} from '@/lib/payments/proposal-view'

import { PackageDetails } from './package-details'
import { PackageHeader } from './package-header'
import { PackageInclusions } from './package-inclusions'
import { PackageTotals } from './package-totals'
import { ProposalBlockProvider } from './proposal-block-context'

/** The package-specific block types that make up the per-package region. */
const PACKAGE_TYPES: ReadonlySet<Block['type']> = new Set([
  'packageHeader',
  'packageDetails',
  'packageInclusions',
  'packageTotals',
])

const EMPTY_DOC = {
  title: '',
  refNumber: '',
  expiresAt: null,
  items: [],
  subtotal: 0,
  taxRate: 0,
}

/** Resolved styling for the accept/decline CTA, from the action block. */
export interface AcceptStyle {
  color: string
  radius: number
  primaryLabel?: string
  secondaryLabel?: string | null
}

export interface ProposalBlocksRendererProps {
  /** The proposal's block tree. */
  blocks: Block[]
  /** Raw resolved branding payload. */
  branding: PublicBranding
  /** Proposal view branding (resolved scalar values). */
  view: ProposalViewBranding
  /** Available package options — one renders single, several stack. */
  options: PublicProposalOption[]
  /** Proposal state: controls affordances. */
  state: 'active' | 'accepted' | 'declined' | 'expired'
  /** Expiry timestamp if known. */
  expiresAt: string | null
  /** Accepted view: the recorded option, so only that package renders. */
  acceptedOptionId?: string | null
  /** Accepted view: the recorded add-on selection for that package. */
  acceptedSelection?: Record<string, boolean>
  /** Render the Accept CTA for one package with its live add-on selection. */
  renderPackageAccept?: (ctx: {
    option: PublicProposalOption
    selection: Record<string, boolean>
    style: AcceptStyle
  }) => ReactNode
  /** Render the single Decline shown once at the bottom of the stack. */
  renderDecline?: (ctx: { style: AcceptStyle }) => ReactNode
}

/**
 * Render a proposal block tree with the package region stacked per package.
 */
export function ProposalBlocksRenderer({
  blocks,
  branding,
  view,
  options,
  state,
  expiresAt,
  acceptedOptionId,
  acceptedSelection,
  renderPackageAccept,
  renderDecline,
}: ProposalBlocksRendererProps) {
  if (options.length === 0) return null

  const visible = blocks.filter((block) => !block.hidden)
  const packageBlocks = visible.filter((b) => PACKAGE_TYPES.has(b.type))
  const firstPackageIdx = visible.findIndex((b) => PACKAGE_TYPES.has(b.type))

  // The action block styles the Accept/Decline CTAs but is not rendered on its
  // own — its style flows into every per-package Accept and the bottom Decline.
  const actionBlock = visible.find((b) => b.type === 'action')
  const style: AcceptStyle =
    actionBlock && actionBlock.type === 'action'
      ? {
          color: actionBlock.buttonColor ?? view.brand,
          radius: actionBlock.buttonRadius ?? view.cornerRadius,
          primaryLabel: actionBlock.primary,
          secondaryLabel: actionBlock.secondary,
        }
      : { color: view.brand, radius: view.cornerRadius }

  // Accepted proposals pin to the recorded package; every other state stacks
  // all the packages the MC offered.
  const stacked =
    state === 'accepted' && acceptedOptionId
      ? options.filter((o) => o.id === acceptedOptionId)
      : options

  return (
    <div>
      {visible.map((block, i) => {
        // The package blocks + the action block are owned by the stack; render
        // it once, at the first package block's position, and skip the rest.
        if (PACKAGE_TYPES.has(block.type) || block.type === 'action') {
          return i === firstPackageIdx ? (
            <PackageStack
              key="package-stack"
              stacked={stacked}
              packageBlocks={packageBlocks}
              branding={branding}
              view={view}
              state={state}
              expiresAt={expiresAt}
              acceptedSelection={acceptedSelection}
              style={style}
              renderPackageAccept={renderPackageAccept}
              renderDecline={renderDecline}
            />
          ) : null
        }
        // Chrome blocks render once, in place.
        return (
          <PublicBlockRenderer key={block.id} blocks={[block]} branding={branding} doc={EMPTY_DOC} hideAction />
        )
      })}
    </div>
  )
}

interface PackageStackProps {
  stacked: PublicProposalOption[]
  packageBlocks: Block[]
  branding: PublicBranding
  view: ProposalViewBranding
  state: 'active' | 'accepted' | 'declined' | 'expired'
  expiresAt: string | null
  acceptedSelection?: Record<string, boolean>
  style: AcceptStyle
  renderPackageAccept?: ProposalBlocksRendererProps['renderPackageAccept']
  renderDecline?: ProposalBlocksRendererProps['renderDecline']
}

/** Stacks each package's region, then a single Decline while active. */
function PackageStack({
  stacked,
  packageBlocks,
  branding,
  view,
  state,
  expiresAt,
  acceptedSelection,
  style,
  renderPackageAccept,
  renderDecline,
}: PackageStackProps) {
  const p = pad(branding)

  return (
    <div>
      {stacked.map((option, idx) => (
        <StackedPackage
          key={option.id}
          option={option}
          packageBlocks={packageBlocks}
          branding={branding}
          view={view}
          state={state}
          expiresAt={expiresAt}
          initialSelection={state === 'active' ? defaultSelection(option) : acceptedSelection ?? {}}
          interactive={state === 'active'}
          style={style}
          renderPackageAccept={renderPackageAccept}
          showDivider={idx > 0}
        />
      ))}
      {state === 'active' ? (
        <div className={`${p.docX} ${p.blockY}`}>
          {renderDecline ? renderDecline({ style }) : <StaticDecline style={style} view={view} />}
        </div>
      ) : null}
    </div>
  )
}

interface StackedPackageProps {
  option: PublicProposalOption
  packageBlocks: Block[]
  branding: PublicBranding
  view: ProposalViewBranding
  state: 'active' | 'accepted' | 'declined' | 'expired'
  expiresAt: string | null
  initialSelection: Record<string, boolean>
  interactive: boolean
  style: AcceptStyle
  renderPackageAccept?: ProposalBlocksRendererProps['renderPackageAccept']
  showDivider: boolean
}

/**
 * One package in the stack: its four package blocks (rendered from the shared
 * template but bound to this option) plus its own Accept. Holds this package's
 * add-on selection locally so ticking extras here does not affect other
 * stacked packages.
 */
function StackedPackage({
  option,
  packageBlocks,
  branding,
  view,
  state,
  expiresAt,
  initialSelection,
  interactive,
  style,
  renderPackageAccept,
  showDivider,
}: StackedPackageProps) {
  const [selection, setSelection] = useState(initialSelection)
  const p = pad(branding)

  const contextValue = {
    options: [option],
    chosenId: option.id,
    selection,
    onChoose: undefined,
    onToggle: interactive
      ? (itemId: string, next: boolean) => setSelection((s) => ({ ...s, [itemId]: next }))
      : undefined,
    branding,
    view,
    expiresAt,
    state,
  }

  return (
    <ProposalBlockProvider value={contextValue}>
      {showDivider ? (
        <div className={`${p.docX} ${p.blockY}`}>
          <div className="border-t" style={{ borderTopColor: branding.border_color }} />
        </div>
      ) : null}
      {packageBlocks.map((block) => (
        <BlockOuter key={block.id} block={block} branding={branding}>
          <PackageBlockBody block={block} />
        </BlockOuter>
      ))}
      {interactive ? (
        <div className={`${p.docX} ${p.blockY}`}>
          {renderPackageAccept ? (
            renderPackageAccept({ option, selection, style })
          ) : (
            <StaticAccept style={style} view={view} />
          )}
        </div>
      ) : null}
    </ProposalBlockProvider>
  )
}

/**
 * Non-interactive Accept button shown in previews (editor / composer) where no
 * live accept handler is wired. Styled from the action block, labelled from its
 * primary text.
 */
function StaticAccept({ style, view }: { style: AcceptStyle; view: ProposalViewBranding }) {
  return (
    <button
      type="button"
      disabled
      className="w-full py-3.5 cursor-default"
      style={{
        backgroundColor: style.color,
        color: getTextColor(style.color),
        borderRadius: Math.min(style.radius, 14),
        fontSize: '15px',
        fontWeight: 500,
        fontFamily: view.bodyFontFamily,
      }}
    >
      {style.primaryLabel || 'Accept'}
    </button>
  )
}

/**
 * Non-interactive Decline link shown once in previews where no live decline
 * handler is wired.
 */
function StaticDecline({ style, view }: { style: AcceptStyle; view: ProposalViewBranding }) {
  return (
    <div className="text-center">
      <span
        style={{
          color: view.mutedColor,
          fontSize: '13px',
          textDecoration: 'underline',
          textUnderlineOffset: '2px',
          fontFamily: view.bodyFontFamily,
        }}
      >
        {style.secondaryLabel || 'Decline'}
      </span>
    </div>
  )
}

/** Dispatch a single package block to its component. */
function PackageBlockBody({ block }: { block: Block }) {
  switch (block.type) {
    case 'packageHeader':
      return <PackageHeader block={block} />
    case 'packageDetails':
      return <PackageDetails block={block} />
    case 'packageInclusions':
      return <PackageInclusions block={block} />
    case 'packageTotals':
      return <PackageTotals block={block} />
    default:
      return null
  }
}

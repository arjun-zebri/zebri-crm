'use client'

import { type ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports -- Block is the canonical block-tree type, authored in the branding editor
import type { Block } from '@/app/(dashboard)/branding/blocks/types'

import { blockOuterStyle, hasOuterStyle, HPAD_EXEMPT_TYPES } from './block-outer-style'
import { RenderAction } from './public-blocks/action'
import { RenderBusinessName } from './public-blocks/business-name'
import { RenderDivider } from './public-blocks/divider'
import { RenderFooter } from './public-blocks/footer'
import { RenderHeaderBanner } from './public-blocks/header-banner'
import { RenderImage } from './public-blocks/image'
import { RenderLineItems } from './public-blocks/line-items'
import { RenderPaymentDetails } from './public-blocks/payment-details'
import { RenderPaymentSchedule } from './public-blocks/payment-schedule'
import {
  pad,
  type PublicDocData,
  type ActionSlotProps,
} from './public-blocks/shared'
import { RenderSpacer } from './public-blocks/spacer'
import { RenderTagline } from './public-blocks/tagline'
import { RenderText } from './public-blocks/text'
import { RenderTitle } from './public-blocks/title'
import { RenderTotals } from './public-blocks/totals'
import { buildVariableValues } from './public-blocks/variable-values'
import type { PublicBranding } from './public-surface'

export type { PublicDocItem, PublicDocData } from './public-blocks/shared'

interface PublicRendererProps extends ActionSlotProps {
  blocks: Block[]
  branding: PublicBranding
  doc: PublicDocData
}

export function PublicBlockRenderer(props: PublicRendererProps) {
  return (
    <div
      style={{ ['--doc-link' as string]: props.branding.link_color }}
      className="[&_a]:[color:var(--doc-link)]"
    >
      {props.blocks
        .filter((b) => !b.hidden)
        .map((b) => (
          <BlockOuter key={b.id} block={b} branding={props.branding}>
            <BlockBody block={b} {...props} />
          </BlockOuter>
        ))}
    </div>
  )
}

/**
 * Wrap a block in its per-block outer styles (padding, background, border,
 * radius, alignment, spacing). Exported so surfaces that render blocks outside
 * {@link PublicBlockRenderer} (the proposal renderer, which substitutes its own
 * package blocks) apply the exact same outer treatment and can't drift.
 */
export function BlockOuter({
  block,
  branding,
  children,
}: {
  block: Block
  branding: PublicBranding
  children: ReactNode
}) {
  // Horizontal document padding lives here, in one place, not in each block.
  // Every block is inset by the shared docX except the full-bleed types, which
  // render edge-to-edge. Vertical rhythm (blockY) stays inside each block.
  const inner = HPAD_EXEMPT_TYPES.has(block.type) ? (
    children
  ) : (
    <div className={pad(branding).docX}>{children}</div>
  )

  // Fast path: if no outer style is set, skip the style wrapper.
  if (!hasOuterStyle(block)) return <>{inner}</>

  const style = blockOuterStyle(block, { cornerRadius: branding.corner_radius })
  return (
    <div
      style={style}
      className={style.borderRadius !== undefined || block.borderWidth ? 'overflow-hidden' : ''}
    >
      {inner}
    </div>
  )
}

function BlockBody(props: PublicRendererProps & { block: Block }) {
  const { block, branding, doc } = props
  switch (block.type) {
    case 'headerBanner': return <RenderHeaderBanner block={block} branding={branding} />
    case 'businessName': return <RenderBusinessName block={block} branding={branding} />
    case 'tagline':      return <RenderTagline block={block} branding={branding} />
    case 'title':        return <RenderTitle block={block} branding={branding} doc={doc} />
    case 'lineItems':    return <RenderLineItems block={block} branding={branding} doc={doc} />
    case 'totals':       return <RenderTotals block={block} branding={branding} doc={doc} />
    case 'paymentDetails': return <RenderPaymentDetails block={block} branding={branding} variableValues={buildVariableValues(branding, doc)} />
    case 'text':         return <RenderText block={block} branding={branding} variableValues={buildVariableValues(branding, doc)} />
    case 'action':       return (
      <RenderAction
        block={block}
        branding={branding}
        onPrimary={props.onPrimary}
        onSecondary={props.onSecondary}
        primaryLabel={props.primaryLabel}
        secondaryLabel={props.secondaryLabel}
        primaryDisabled={props.primaryDisabled}
        primaryLoading={props.primaryLoading}
        hideAction={props.hideAction}
      />
    )
    case 'divider':      return <RenderDivider block={block} branding={branding} />
    case 'footer':       return <RenderFooter block={block} branding={branding} variableValues={buildVariableValues(branding, doc)} />
    case 'spacer':       return <RenderSpacer block={block} branding={branding} />
    case 'couplePortal': return null
    case 'paymentSchedule': return <RenderPaymentSchedule block={block} branding={branding} doc={doc} />
    case 'contractBody': return null
    case 'proposalBody': return null
    case 'vendorTimelineBody': return null
    case 'questionnaireBody': return null
    case 'image': return <RenderImage block={block} branding={branding} />
  }
}

/**
 * Extract the action block's button color + radius from a saved block tree.
 * Used by surfaces (invoice, contract) where we hide the renderer's action
 * block in favour of their own multi-step UI, so the user's customised colour
 * still flows through to the Pay / Sign buttons.
 */
export function findActionStyle(
  blocks: Block[] | null | undefined,
  fallback: { brandColor: string; cornerRadius: number },
): { color: string; radius: number; primaryLabel?: string; secondaryLabel?: string | null } {
  const action = blocks?.find((b) => b.type === 'action')
  if (!action || action.type !== 'action') {
    return {
      color: fallback.brandColor,
      radius: Math.min(fallback.cornerRadius, 12),
    }
  }
  return {
    color: action.buttonColor ?? fallback.brandColor,
    radius: action.buttonRadius ?? Math.min(fallback.cornerRadius, 12),
    primaryLabel: action.primary,
    secondaryLabel: action.secondary,
  }
}

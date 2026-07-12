'use client'

import { type ReactNode } from 'react'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'

import { blockOuterStyle, hasOuterStyle } from './block-outer-style'
import { RenderAction } from './public-blocks/action'
import { RenderBusinessName } from './public-blocks/business-name'
import { RenderDivider } from './public-blocks/divider'
import { RenderFooter } from './public-blocks/footer'
import { RenderHeaderBanner } from './public-blocks/header-banner'
import { RenderImage } from './public-blocks/image'
import { RenderLineItems } from './public-blocks/line-items'
import { RenderPaymentDetails } from './public-blocks/payment-details'
import {
  type PublicDocData,
  type ActionSlotProps,
} from './public-blocks/shared'
import { RenderSpacer } from './public-blocks/spacer'
import { RenderTagline } from './public-blocks/tagline'
import { RenderText } from './public-blocks/text'
import { RenderTitle } from './public-blocks/title'
import { RenderTotals } from './public-blocks/totals'
import type { PublicBranding } from './public-surface'

export type { PublicDocItem, PublicDocData } from './public-blocks/shared'

interface PublicRendererProps extends ActionSlotProps {
  blocks: Block[]
  branding: PublicBranding
  doc: PublicDocData
}

export function PublicBlockRenderer(props: PublicRendererProps) {
  return (
    <>
      {props.blocks
        .filter((b) => !b.hidden)
        .map((b) => (
          <BlockOuter key={b.id} block={b} branding={props.branding}>
            <BlockBody block={b} {...props} />
          </BlockOuter>
        ))}
    </>
  )
}

function BlockOuter({
  block,
  branding,
  children,
}: {
  block: Block
  branding: PublicBranding
  children: ReactNode
}) {
  // Fast path: if no outer style is set, render without wrapper to preserve byte-identical output
  if (!hasOuterStyle(block)) return <>{children}</>

  const style = blockOuterStyle(block, { cornerRadius: branding.corner_radius })
  return (
    <div
      style={style}
      className={style.borderRadius !== undefined || block.borderWidth ? 'overflow-hidden' : ''}
    >
      {children}
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
    case 'paymentDetails': return <RenderPaymentDetails block={block} branding={branding} />
    case 'text':         return <RenderText block={block} branding={branding} />
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
    case 'footer':       return <RenderFooter block={block} branding={branding} />
    case 'spacer':       return <RenderSpacer block={block} branding={branding} />
    case 'couplePortal': return null
    case 'paymentSchedule': return null
    case 'contractBody': return null
    case 'proposalBody': return null
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

'use client'

import { type ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports -- Block is the canonical block-tree type, authored in the branding editor
import type { Block } from '@/app/(dashboard)/branding/blocks/types'

import { blockOuterStyle, hasOuterStyle, HPAD_EXEMPT_TYPES } from './block-outer-style'
import { PageSection } from './page-section'
import { RenderAction } from './public-blocks/action'
import { RenderBusinessName } from './public-blocks/business-name'
import { RenderDivider } from './public-blocks/divider'
import { RenderFooter } from './public-blocks/footer'
import { RenderHeaderBanner } from './public-blocks/header-banner'
import { RenderImage } from './public-blocks/image'
import { RenderLineItems } from './public-blocks/line-items'
import { RenderPaymentDetails } from './public-blocks/payment-details'
import { RenderPaymentSchedule } from './public-blocks/payment-schedule'
import { RenderAboutMe } from './public-blocks/proposal/about-me'
import { RenderAccept } from './public-blocks/proposal/accept'
import { RenderFaq } from './public-blocks/proposal/faq'
import { RenderGallery } from './public-blocks/proposal/gallery'
import { RenderHero } from './public-blocks/proposal/hero'
import { RenderHowItWorks } from './public-blocks/proposal/how-it-works'
import { RenderIntroNote } from './public-blocks/proposal/intro-note'
import { RenderPackages } from './public-blocks/proposal/packages'
import { RenderTestimonials } from './public-blocks/proposal/testimonials'
import { RenderVideo } from './public-blocks/proposal/video'
import {
  pad,
  type PublicDocData,
  type ActionSlotProps,
  type FrameMode,
  type ProposalSlotProps,
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
  /** Framing; defaults to the 720px document so existing surfaces are untouched. */
  frame?: FrameMode | undefined
  /** Selection state for the proposal's packages / accept blocks (public page only). */
  proposal?: ProposalSlotProps | undefined
}

export function PublicBlockRenderer(props: PublicRendererProps) {
  const frame = props.frame ?? 'document'
  return (
    <div
      style={{ ['--doc-link' as string]: props.branding.link_color }}
      className="[&_a]:[color:var(--doc-link)]"
    >
      {props.blocks
        .filter((b) => !b.hidden)
        .map((b) => (
          <BlockOuter key={b.id} block={b} branding={props.branding} frame={frame}>
            <BlockBody block={b} {...props} frame={frame} />
          </BlockOuter>
        ))}
    </div>
  )
}

/**
 * Wrap a block in its per-block outer styles (padding, background, border,
 * radius, alignment, spacing). Exported so surfaces that render blocks outside
 * {@link PublicBlockRenderer} apply the exact same outer treatment and can't
 * drift.
 */
export function BlockOuter({
  block,
  branding,
  frame = 'document',
  children,
}: {
  block: Block
  branding: PublicBranding
  frame?: FrameMode | undefined
  children: ReactNode
}) {
  // In the page frame, the section owns the horizontal inset (it wraps a
  // centred `max-w-doc-page` column) so the shared docX padding below would
  // double it up. Per-block outer styles (background, border, radius, …)
  // still apply, nested inside the section's column.
  if (frame === 'page') {
    const style = hasOuterStyle(block) ? blockOuterStyle(block, { cornerRadius: branding.corner_radius }) : undefined
    return (
      <PageSection block={block} branding={branding} frame={frame}>
        {style ? <div style={style}>{children}</div> : children}
      </PageSection>
    )
  }

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

function BlockBody(props: PublicRendererProps & { block: Block; frame: FrameMode }) {
  const { block, branding, doc, frame } = props
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
    // Every signature marker renders nothing generically: the public contract
    // card injects the real panel at each marker's position.
    case 'contractSign':
    case 'contractSignVendor':
    case 'contractSignPrimary':
    case 'contractSignSecondary':
      return null
    case 'vendorTimelineBody': return null
    case 'questionnaireOneAtATime': return null
    case 'questionnaireAllOnePage': return null
    case 'image': return <RenderImage block={block} branding={branding} />
    // The Website form field + submit blocks are interactive: the live form
    // wrapper (app/lead/[token]/_components/lead-form.tsx) injects the real
    // controls at their positions, so the generic static renderer emits nothing.
    case 'formField': return null
    case 'formSubmit': return null
    // Proposal blocks: the seven static ones are wired below (Task 4). The
    // three data-bound ones (introNote/packages/accept) render from
    // `doc.proposal` (Task 5) and emit null on every other surface, since
    // only the proposal payload ever populates that field.
    case 'hero':         return <RenderHero block={block} branding={branding} doc={doc} frame={frame} variableValues={buildVariableValues(branding, doc)} />
    case 'introNote':    return <RenderIntroNote block={block} branding={branding} doc={doc} variableValues={buildVariableValues(branding, doc)} />
    case 'video':        return <RenderVideo block={block} branding={branding} frame={frame} variableValues={buildVariableValues(branding, doc)} />
    case 'gallery':      return <RenderGallery block={block} branding={branding} />
    case 'testimonials': return <RenderTestimonials block={block} branding={branding} variableValues={buildVariableValues(branding, doc)} />
    case 'aboutMe':      return <RenderAboutMe block={block} branding={branding} variableValues={buildVariableValues(branding, doc)} />
    case 'howItWorks':   return <RenderHowItWorks block={block} branding={branding} variableValues={buildVariableValues(branding, doc)} />
    case 'faq':          return <RenderFaq block={block} branding={branding} variableValues={buildVariableValues(branding, doc)} />
    case 'packages':      return <RenderPackages block={block} branding={branding} doc={doc} proposal={props.proposal} variableValues={buildVariableValues(branding, doc)} />
    case 'accept':        return <RenderAccept block={block} branding={branding} doc={doc} proposal={props.proposal} variableValues={buildVariableValues(branding, doc)} />
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

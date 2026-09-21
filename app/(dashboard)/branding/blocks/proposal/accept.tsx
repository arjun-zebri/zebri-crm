'use client'

import { publicBrandingFromEditorState } from '@/app/(dashboard)/branding/editor-branding'
import { getTextColor } from '@/lib/branding/contrast'
import { RenderAccept, type AcceptSlots } from '@/lib/branding/public-blocks/proposal/accept'
import { roleDefaults } from '@/lib/branding/type-defaults'
import type { BrandPreviewState, SurfaceTab } from '@/types/branding-preview'

import { InlineText } from '../inline-text'
import type { ProposalRenderExtras, UpdateBlock } from '../render-proposal'
import { RichText } from '../rich-text/rich-text'
import { SAMPLE_DOC_BY_SURFACE } from '../sample-doc'
import { resolveTextStyle } from '../text-style'
import type { AcceptBlock } from '../types'

import { ProposalText } from './proposal-text'

interface EditAcceptProps {
  block: AcceptBlock
  state: BrandPreviewState
  surface: SurfaceTab
  updateBlock: UpdateBlock
  extras: ProposalRenderExtras
}

/**
 * Editor renderer for the proposal accept marker: heading and reassurance
 * copy are inline-editable template text, but the button is a plain
 * `<span role="presentation">` standing in for the public `<button>` (a real
 * button would swallow the inline editor's own click-to-focus, and there is
 * nothing to accept on the editor canvas), styled identically to it, with
 * its label editable in place via a nested `InlineText`.
 */
export function EditAccept({ block, state, surface, updateBlock }: EditAcceptProps) {
  const branding = publicBrandingFromEditorState(state)
  const doc = SAMPLE_DOC_BY_SURFACE.proposal
  const patch = (p: Partial<AcceptBlock>) => updateBlock<AcceptBlock>(block.id, p)
  const headingStyle = resolveTextStyle(block.headingStyle, roleDefaults(branding, 'sectionHeading'))
  const buttonColor = block.buttonColor ?? branding.brand_color

  const slots: AcceptSlots = {
    heading: (
      <ProposalText subtarget="heading" value={block.heading} onChange={(v) => patch({ heading: v })} placeholder="Heading" />
    ),
    button: (
      <span
        role="presentation"
        className="rounded-control inline-block cursor-text"
        style={{
          background: buttonColor,
          color: getTextColor(buttonColor),
          borderRadius: branding.button_radius,
          padding: '16px 32px',
          fontFamily: headingStyle.fontFamily,
          fontSize: 18,
          fontWeight: headingStyle.fontWeight,
        }}
      >
        <InlineText value={block.buttonLabel} onChange={(v) => patch({ buttonLabel: v })} as="span" />
      </span>
    ),
    reassurance: (
      <RichText
        value={block.reassurance}
        onChange={(v) => patch({ reassurance: v })}
        surface={surface}
        placeholder="Reassurance line under the button"
      />
    ),
  }

  return <RenderAccept block={block} branding={branding} doc={doc} slots={slots} />
}

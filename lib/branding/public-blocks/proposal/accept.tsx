'use client'

import type { CSSProperties, ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { AcceptBlock } from '@/app/(dashboard)/branding/blocks/types'
import { getTextColor } from '@/lib/branding/contrast'

import type { PublicBranding } from '../../public-surface'
import { renderRichText, richTextHasContent } from '../../render-rich-text'
import { resolveTemplateString } from '../../template-string'
import { roleDefaults } from '../../type-defaults'
import { Rich } from '../rich'
import { fmtDate, type ProposalSlotProps, type PublicDocData } from '../shared'

/** Editor slots that replace the static heading / reassurance / button with live inline editors. */
export interface AcceptSlots {
  heading?: ReactNode
  reassurance?: ReactNode
  button?: ReactNode
}

/** Copy shown in place of the button once the proposal is no longer open. */
function stateMessage(state: NonNullable<PublicDocData['proposal']>['state'], acceptedAt: string | null): ReactNode {
  if (state === 'accepted') return `Accepted on ${fmtDate((acceptedAt ?? '').slice(0, 10))}`
  if (state === 'expired') return 'This proposal has expired'
  if (state === 'declined') return 'This proposal was declined'
  if (state === 'signing') return 'Almost there: sign to confirm'
  if (state === 'paying') return 'Booked. Pay the deposit below'
  return null
}

/**
 * The proposal's call to action: a heading, an Accept button (or, once the
 * couple has acted, a plain status line in its place) and a reassurance
 * line under it. No expiry line (2026-09-19 feedback: "the accept section
 * still has some text - remove this"): the section is the button alone,
 * and any note around it is its own content section. Renders nothing
 * without proposal data, same as the other data-bound blocks. The heading
 * and the reassurance line each render only with content (or an editor
 * slot), the same gate the packages/faq/video/testimonials blocks use: a
 * v2 layout section strips both (`features/proposals/render/data-section.tsx`)
 * and must not be left with an empty `<h2>` and a spare margin.
 */
export function RenderAccept({
  block,
  branding,
  doc,
  proposal,
  variableValues,
  slots,
}: {
  block: AcceptBlock
  branding: PublicBranding
  doc: PublicDocData
  proposal?: ProposalSlotProps | undefined
  variableValues?: Record<string, string>
  slots?: AcceptSlots
}) {
  if (!doc.proposal) return null
  const { state, acceptedAt } = doc.proposal
  // A centred call to action by default, but the section's alignment
  // (`--doc-align`, published by the proposal content column) wins when
  // set: the wrapper, heading and fine print all read it with `center`
  // as the fallback, so a v1 tree (public-renderer.tsx), which sets no
  // section alignment, stays centred exactly as before. Hard-coding
  // `text-center` plus an inline centre on the fine print was why the
  // Style popover's Alignment pill did nothing on this section (live
  // bug, 2026-09-19). An explicit heading alignment the MC chose on the
  // block still beats both.
  // csstype's `TextAlign` union has no room for a `var()`; it is valid CSS.
  const sectionAlign = 'var(--doc-align, center)' as CSSProperties['textAlign']
  const headingStyle = {
    ...resolveTextStyle(block.headingStyle, roleDefaults(branding, 'sectionHeading')),
    ...(block.headingStyle?.align ? {} : { textAlign: sectionAlign }),
  }
  const finePrintStyle = { ...resolveTextStyle(undefined, roleDefaults(branding, 'finePrint')), textAlign: sectionAlign }
  const buttonColor = block.buttonColor ?? branding.brand_color
  const message = stateMessage(state, acceptedAt)

  return (
    <div style={{ textAlign: sectionAlign }}>
      {(richTextHasContent(block.heading) || slots?.heading) && (
        <h2 className="m-0 mb-4" style={headingStyle}>{slots?.heading ?? <Rich value={block.heading} values={variableValues} inline />}</h2>
      )}
      {state === 'open' ? (
        slots?.button ?? (
          <button
            type="button"
            onClick={proposal?.onAccept}
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
            {resolveTemplateString(block.buttonLabel, variableValues ?? {})}
          </button>
        )
      ) : (
        <p className="m-0" style={{ ...finePrintStyle, color: branding.muted_color }}>{message}</p>
      )}
      {slots?.reassurance ? (
        // The editor's inline field sits in the same fine-print wrapper the
        // public line uses, so it reads (size, colour, centring) exactly as
        // the couple will see it rather than as body text.
        <div className="mt-4" style={{ ...finePrintStyle, color: branding.muted_color }}>{slots.reassurance}</div>
      ) : richTextHasContent(block.reassurance) ? (
        <div
          className="mt-4"
          style={{ ...finePrintStyle, color: branding.muted_color }}
          dangerouslySetInnerHTML={{ __html: renderRichText(block.reassurance, variableValues ?? {}) }}
        />
      ) : null}
      {state === 'open' && proposal?.onDecline ? (
        <button
          type="button"
          onClick={proposal.onDecline}
          className="mt-3 underline"
          style={{ ...finePrintStyle, color: branding.muted_color }}
        >
          Not the right fit? Let us know
        </button>
      ) : null}
    </div>
  )
}

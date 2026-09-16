'use client'

import type { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { AcceptBlock } from '@/app/(dashboard)/branding/blocks/types'
import { getTextColor } from '@/lib/branding/contrast'

import type { PublicBranding } from '../../public-surface'
import { renderRichText } from '../../render-rich-text'
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
 * Calm, factual line about the proposal's expiry, shown under the button
 * while it is still open. Returns null with no expiry date at all, so a
 * proposal that never expires shows nothing extra.
 *
 * A same-day or next-day expiry is named ("today" / "tomorrow") and a
 * handful of days out gets a day count, since a bare date reads ambiguous
 * with that little runway. Anything further out is left as a plain date:
 * naming a day count for a date months away would read as a pushed
 * deadline rather than the fact it is.
 */
function expiryMessage(expiresAt: string | null): ReactNode {
  if (!expiresAt) return null
  const today = new Date().toISOString().slice(0, 10)
  const days = Math.round((Date.parse(`${expiresAt}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
  const when = days <= 0 ? ' (today)' : days === 1 ? ' (tomorrow)' : days <= 3 ? ` (in ${days} days)` : ''
  return `This offer is open until ${fmtDate(expiresAt)}${when}.`
}

/**
 * The proposal's call to action: a heading, an Accept button (or, once the
 * couple has acted, a plain status line in its place), an expiry line while
 * it is still open, and a reassurance line under it all. Renders nothing
 * without proposal data, same as the other data-bound blocks.
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
  const headingStyle = resolveTextStyle(block.headingStyle, roleDefaults(branding, 'sectionHeading'))
  const finePrintStyle = resolveTextStyle(undefined, roleDefaults(branding, 'finePrint'))
  const buttonColor = block.buttonColor ?? branding.brand_color
  const message = stateMessage(state, acceptedAt)
  const expiry = state === 'open' ? expiryMessage(doc.expiresAt) : null

  return (
    <div className="text-center">
      <h2 className="m-0 mb-4" style={headingStyle}>{slots?.heading ?? <Rich value={block.heading} values={variableValues} inline />}</h2>
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
            {block.buttonLabel}
          </button>
        )
      ) : (
        <p className="m-0" style={{ ...finePrintStyle, color: branding.muted_color }}>{message}</p>
      )}
      {expiry ? (
        <p className="m-0 mt-2" style={{ ...finePrintStyle, color: branding.muted_color }}>{expiry}</p>
      ) : null}
      {slots?.reassurance ?? (
        <div
          className="mt-4"
          style={{ ...finePrintStyle, color: branding.muted_color }}
          dangerouslySetInnerHTML={{ __html: renderRichText(block.reassurance, variableValues ?? {}) }}
        />
      )}
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

'use client'

import type { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { IntroNoteBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../../public-surface'
import { renderRichText, richTextHasContent } from '../../render-rich-text'
import { roleDefaults } from '../../type-defaults'
import { Rich } from '../rich'
import type { PublicDocData } from '../shared'

/** Editor slots that replace the static heading / note with live inline editors. */
export interface IntroNoteSlots {
  heading?: ReactNode
  note?: ReactNode
}

/**
 * The MC's personal note to the couple, opening the proposal. Renders
 * nothing without proposal data or an empty note, so an untouched block
 * never shows a blank section on a sent proposal.
 */
export function RenderIntroNote({
  block,
  branding,
  doc,
  variableValues,
  slots,
}: {
  block: IntroNoteBlock
  branding: PublicBranding
  doc: PublicDocData
  variableValues?: Record<string, string>
  slots?: IntroNoteSlots
}) {
  if (!doc.proposal && !slots?.note) return null
  const html = doc.proposal ? renderRichText(doc.proposal.introNote, variableValues ?? {}) : ''
  if (!html && !slots?.note) return null

  const headingStyle = resolveTextStyle(block.headingStyle, roleDefaults(branding, 'sectionHeading'))
  const bodyStyle = resolveTextStyle(block.textStyle, roleDefaults(branding, 'body'))
  // The prose box follows the note's alignment, so "centre" in the toolbar
  // centres the note in the section rather than inside a left-pinned box.
  const boxAlign = block.textStyle?.align === 'center' ? 'mx-auto' : block.textStyle?.align === 'right' ? 'ml-auto' : ''

  return (
    <div className={`max-w-doc-prose ${boxAlign}`}>
      {(richTextHasContent(block.heading) || slots?.heading) && (
        <h2 className="m-0 mb-4" style={headingStyle}>{slots?.heading ?? <Rich value={block.heading} values={variableValues} inline />}</h2>
      )}
      {slots?.note ?? (
        <div className="[&_p]:mb-3" style={bodyStyle} dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </div>
  )
}

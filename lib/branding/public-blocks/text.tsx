'use client'

import { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { TextBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../public-surface'
import { renderRichText, richContentToPlainText } from '../render-rich-text'
import { roleDefaults } from '../type-defaults'

import { pad } from './shared'

export interface TextSlots {
  /** Editor replaces static rendered content with the live RichText editor. */
  text?: ReactNode
}

/**
 * Public renderer for a rich-text block. Renders the stored TipTap JSON to
 * sanitized HTML with variable chips resolved to their real values
 * (`renderRichText`). The editor passes a `slots.text` (the live RichText
 * component) instead.
 */
export function RenderText({
  block,
  branding,
  slots,
  variableValues,
  chrome,
}: {
  block: TextBlock
  branding: PublicBranding
  slots?: TextSlots
  /** Variable id -> display value map for resolving chips. */
  variableValues?: Record<string, string>
  chrome?: ReactNode
}) {
  // Empty when there is neither an editor slot nor any rendered text.
  if (!slots?.text && !richContentToPlainText(block.text)) return null
  const p = pad(branding)
  const defaults = roleDefaults(branding, 'body')
  return (
    <div className={`${p.docX} ${p.blockY} [&_p]:m-0`} style={resolveTextStyle(block.textStyle, defaults)}>
      {slots?.text ?? (
        <div
          className="break-words"
          dangerouslySetInnerHTML={{ __html: renderRichText(block.text, variableValues ?? {}) }}
        />
      )}
      {chrome}
    </div>
  )
}

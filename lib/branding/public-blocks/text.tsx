'use client'

import { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle, type TextStyleDefaults } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { TextBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../public-surface'
import { pad } from './shared'
import { Html } from './html'

export interface TextSlots {
  /** Editor replaces static sanitized HTML with live InlineText. */
  text?: ReactNode
}

export function RenderText({
  block,
  branding,
  slots,
  chrome,
}: {
  block: TextBlock
  branding: PublicBranding
  slots?: TextSlots
  chrome?: ReactNode
}) {
  if (!block.text && !slots?.text) return null
  const p = pad(branding)
  const defaults: TextStyleDefaults = {
    fontFamily: branding.font_body,
    fontSize: 14,
    fontWeight: branding.font_body_weight,
    color: branding.muted_color || '#6B7280',
    align: 'left',
    lineHeight: 1.6,
    letterSpacing: 0,
  }
  return (
    <div className={`${p.docX} ${p.blockY}`} style={resolveTextStyle(block.textStyle, defaults)}>
      {slots?.text ?? (
        <Html value={block.text} as="div" className="whitespace-pre-wrap break-words" />
      )}
      {chrome}
    </div>
  )
}

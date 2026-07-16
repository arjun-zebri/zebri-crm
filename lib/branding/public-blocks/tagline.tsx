'use client'

import { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle, type TextStyleDefaults } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { TaglineBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../public-surface'
import { pad } from './shared'
import { Html } from './html'

export interface TaglineSlots {
  /** Editor replaces static tagline with live InlineText. */
  text?: ReactNode
}

export function RenderTagline({
  block,
  branding,
  slots,
  chrome,
}: {
  block: TaglineBlock
  branding: PublicBranding
  slots?: TaglineSlots
  chrome?: ReactNode
}) {
  if (!branding.tagline && !slots?.text) return null
  const p = pad(branding)
  const defaults: TextStyleDefaults = {
    fontFamily: branding.font_body,
    fontSize: 14,
    fontWeight: branding.font_body_weight,
    color: branding.muted_color || '#6B7280',
    align: 'left',
    lineHeight: 1.4,
    letterSpacing: 0,
  }
  return (
    <div className={`${p.docX} ${p.blockY}`}>
      <p style={resolveTextStyle(block.textStyle, defaults)}>
        {slots?.text ?? (
          <Html value={branding.tagline!} allowLists={false} />
        )}
      </p>
      {chrome}
    </div>
  )
}

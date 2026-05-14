'use client'

import { resolveTextStyle, type TextStyleDefaults } from '@/app/(dashboard)/branding/blocks/text-style'
import type { TextBlock } from '@/app/(dashboard)/branding/blocks/types'
import type { PublicBranding } from '../public-surface'
import { pad } from './shared'

export function RenderText({
  block,
  branding,
}: {
  block: TextBlock
  branding: PublicBranding
}) {
  if (!block.text) return null
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
      <div className="whitespace-pre-wrap">{block.text}</div>
    </div>
  )
}

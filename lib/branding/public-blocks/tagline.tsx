'use client'

import { resolveTextStyle, type TextStyleDefaults } from '@/app/(dashboard)/branding/blocks/text-style'
import type { TaglineBlock } from '@/app/(dashboard)/branding/blocks/types'
import type { PublicBranding } from '../public-surface'
import { pad } from './shared'
import { Html } from './html'

export function RenderTagline({
  block,
  branding,
}: {
  block: TaglineBlock
  branding: PublicBranding
}) {
  if (!branding.tagline) return null
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
        <Html value={branding.tagline} allowLists={false} />
      </p>
    </div>
  )
}

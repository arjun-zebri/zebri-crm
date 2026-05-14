'use client'

import { resolveTextStyle, type TextStyleDefaults } from '@/app/(dashboard)/branding/blocks/text-style'
import type { BusinessNameBlock } from '@/app/(dashboard)/branding/blocks/types'
import { FONT_STACKS } from '../fonts'
import type { PublicBranding } from '../public-surface'
import { pad } from './shared'

export function RenderBusinessName({
  block,
  branding,
}: {
  block: BusinessNameBlock
  branding: PublicBranding
}) {
  const p = pad(branding)
  const markUrl = branding.logo_url || branding.favicon_url
  const businessName = branding.business_name
  const fallbackInitial = businessName?.[0]?.toUpperCase() || 'Z'

  const nameDefaults: TextStyleDefaults = {
    fontFamily: branding.font_heading,
    fontSize: 16,
    fontWeight: 600,
    color: branding.text_color || '#111827',
    align: 'left',
    lineHeight: 1.3,
    letterSpacing: 0,
  }

  return (
    <div className={`${p.docX} ${p.blockY} flex items-center gap-4`}>
      {markUrl ? (
        <img
          src={markUrl}
          alt={businessName || 'Logo'}
          className="w-12 h-12 object-contain rounded-lg bg-white shrink-0"
        />
      ) : (
        <div
          className="w-12 h-12 shrink-0 flex items-center justify-center text-white font-semibold"
          style={{
            background: branding.brand_color,
            borderRadius: Math.min(branding.corner_radius, 12),
            fontFamily: FONT_STACKS[branding.font_heading],
          }}
        >
          {fallbackInitial}
        </div>
      )}
      <p className="truncate" style={resolveTextStyle(block.nameStyle, nameDefaults)}>
        {businessName || 'Your business name'}
      </p>
    </div>
  )
}

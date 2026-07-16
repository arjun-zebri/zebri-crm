'use client'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle, type TextStyleDefaults } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { BusinessNameBlock } from '@/app/(dashboard)/branding/blocks/types'

import { FONT_STACKS } from '../fonts'
import type { PublicBranding } from '../public-surface'
import { pad } from './shared'
import { Html } from './html'

export function RenderBusinessName({
  block,
  branding,
}: {
  block: BusinessNameBlock
  branding: PublicBranding
}) {
  const p = pad(branding)
  const logoUrl = branding.logo_url
  const businessName = branding.business_name
  const fallbackInitial = businessName?.[0]?.toUpperCase() || 'Z'
  const layout = block.layout ?? 'row'
  const logoHeight = block.logoHeightPx ?? 48
  const align = block.nameStyle?.align ?? 'left'

  const nameDefaults: TextStyleDefaults = {
    fontFamily: branding.font_heading,
    fontSize: 16,
    fontWeight: 600,
    color: branding.text_color || '#111827',
    align: 'left',
    lineHeight: 1.3,
    letterSpacing: 0,
  }

  const logoNode = logoUrl ? (
    <img
      src={logoUrl}
      alt={businessName || 'Logo'}
      className="block w-auto object-contain shrink-0"
      style={{ height: logoHeight }}
    />
  ) : (
    <div
      className="shrink-0 flex items-center justify-center text-white font-semibold"
      style={{
        width: logoHeight,
        height: logoHeight,
        background: branding.brand_color,
        borderRadius: Math.min(branding.corner_radius, 12),
        fontFamily: FONT_STACKS[branding.font_heading],
        fontSize: Math.round(logoHeight * 0.42),
      }}
    >
      {fallbackInitial}
    </div>
  )

  const nameNode = (
    <p style={resolveTextStyle(block.nameStyle, nameDefaults)}>
      {businessName ? (
        <Html value={businessName} allowLists={false} />
      ) : (
        'Your business name'
      )}
    </p>
  )

  const justify =
    align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'
  const items =
    align === 'center' ? 'items-center' : align === 'right' ? 'items-end' : 'items-start'

  if (layout === 'logo') {
    return <div className={`${p.docX} ${p.blockY} flex ${justify}`}>{logoNode}</div>
  }
  if (layout === 'name') {
    return <div className={`${p.docX} ${p.blockY} flex ${justify}`}>{nameNode}</div>
  }
  if (layout === 'stacked') {
    return (
      <div className={`${p.docX} ${p.blockY} flex flex-col gap-2 ${items}`}>
        {logoNode}
        {nameNode}
      </div>
    )
  }
  return (
    <div className={`${p.docX} ${p.blockY} flex items-center gap-4 ${justify}`}>
      {logoNode}
      {nameNode}
    </div>
  )
}

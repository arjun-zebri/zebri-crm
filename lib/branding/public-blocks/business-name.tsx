'use client'

import type { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle, type TextStyleDefaults } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { BusinessNameBlock } from '@/app/(dashboard)/branding/blocks/types'

import { FONT_STACKS } from '../fonts'
import type { PublicBranding } from '../public-surface'
import { pad } from './shared'
import { Html } from './html'

/**
 * Slot elements for the business name block. Logo uses selectableWhenEmpty=false.
 */
export interface BusinessNameSlots {
  /** Editor slot for the logo; renders via InlineAsset. */
  logo?: ReactNode
  /** Editor slot for the business name; renders via InlineText. */
  name?: ReactNode
}

/**
 * Renders the business name block with optional editor slots and chrome.
 * On public surfaces, renders static logo + name with no interactivity.
 * In the editor, slots provide live upload/edit controls, and chrome renders
 * resize handles and overlay UI.
 */
export function RenderBusinessName({
  block,
  branding,
  slots,
  chrome,
}: {
  block: BusinessNameBlock
  branding: PublicBranding
  slots?: BusinessNameSlots
  chrome?: ReactNode
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

  // Logo node: editor slot renders if provided, else static fallback.
  const logoNode = slots?.logo !== undefined ? (
    slots.logo
  ) : logoUrl ? (
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

  // Name node: editor slot renders if provided, else static fallback.
  const nameNode = (
    <p style={resolveTextStyle(block.nameStyle, nameDefaults)}>
      {slots?.name !== undefined ? (
        slots.name
      ) : businessName ? (
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
    return (
      <div className={`${p.docX} ${p.blockY} flex ${justify} relative`}>
        {logoNode}
        {chrome}
      </div>
    )
  }
  if (layout === 'name') {
    return (
      <div className={`${p.docX} ${p.blockY} flex ${justify} relative`}>
        {nameNode}
        {chrome}
      </div>
    )
  }
  if (layout === 'stacked') {
    return (
      <div className={`${p.docX} ${p.blockY} flex flex-col gap-2 ${items} relative`}>
        {logoNode}
        {nameNode}
        {chrome}
      </div>
    )
  }
  return (
    <div className={`${p.docX} ${p.blockY} flex items-center gap-4 ${justify} relative`}>
      {logoNode}
      {nameNode}
      {chrome}
    </div>
  )
}

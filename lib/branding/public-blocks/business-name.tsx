'use client'

import type { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle, caseText } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { BusinessNameBlock } from '@/app/(dashboard)/branding/blocks/types'

import { FONT_STACKS } from '../fonts'
import type { PublicBranding } from '../public-surface'
import { roleDefaults } from '../type-defaults'

import { Html } from './html'
import { pad } from './shared'

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
  // Prefer the block-local name override; fall back to the shared brand name when
  // the block has never been edited (`name` undefined). This keeps the My-details
  // block independent from the global brand name and from other business-name blocks.
  const businessName = block.name ?? branding.business_name
  const fallbackInitial = businessName?.[0]?.toUpperCase() || 'Z'
  const layout = block.layout ?? 'row'
  const logoHeight = block.logoHeightPx ?? 40
  // Cap the logo's footprint: object-contain then scales very wide or very
  // tall uploads down inside this box, so an unedited upload never dominates
  // the document. The editor's size grip still overrides via logoHeightPx.
  const logoCap = Math.round(logoHeight * 3.5)
  const align = block.nameStyle?.align ?? 'left'

  const nameDefaults = roleDefaults(branding, 'sectionHeading')

  // Logo node: editor slot renders if provided, else static fallback.
  const logoNode = slots?.logo !== undefined ? (
    <div className="shrink-0" style={{ height: logoHeight, maxWidth: logoCap }}>
      {slots.logo}
    </div>
  ) : logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- user-supplied logo URL, not a Next-optimised static asset
    <img
      src={logoUrl}
      alt={businessName || 'Logo'}
      className="block w-auto max-w-full object-contain shrink-0"
      style={{ height: logoHeight, maxWidth: logoCap }}
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
        caseText('Your business name', block.nameStyle, nameDefaults)
      )}
    </p>
  )

  const justify =
    align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'
  const items =
    align === 'center' ? 'items-center' : align === 'right' ? 'items-end' : 'items-start'

  if (layout === 'logo') {
    return (
      <div className={`${p.blockY} flex ${justify} relative`}>
        {logoNode}
        {chrome}
      </div>
    )
  }
  if (layout === 'name') {
    return (
      <div className={`${p.blockY} flex ${justify} relative`}>
        {nameNode}
        {chrome}
      </div>
    )
  }
  if (layout === 'stacked') {
    return (
      <div className={`${p.blockY} flex flex-col gap-2 ${items} relative`}>
        {logoNode}
        {nameNode}
        {chrome}
      </div>
    )
  }
  return (
    <div className={`${p.blockY} flex items-center gap-4 ${justify} relative`}>
      {logoNode}
      {nameNode}
      {chrome}
    </div>
  )
}

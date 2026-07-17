'use client'

import { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle, type TextStyleDefaults } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { ActionBlock } from '@/app/(dashboard)/branding/blocks/types'
import { getTextColor } from '../contrast'
import type { PublicBranding } from '../public-surface'
import { pad, type ActionSlotProps } from './shared'
import { Html } from './html'

/**
 * Editor slots for customizing button text content.
 * Allows the editor to inject InlineText components for live editing of button labels.
 */
export interface ActionSlots {
  /** Editor replaces static primary button text with live InlineText. */
  primary?: ReactNode
  /** Editor replaces static secondary button text with live InlineText. */
  secondary?: ReactNode
}

export function RenderAction({
  block,
  branding,
  slots,
  onPrimary,
  onSecondary,
  primaryLabel,
  secondaryLabel,
  primaryDisabled,
  primaryLoading,
  hideAction,
}: {
  block: ActionBlock
  branding: PublicBranding
  slots?: ActionSlots
} & ActionSlotProps) {
  if (hideAction) return null
  const p = pad(branding)
  const buttonColor = block.buttonColor ?? branding.brand_color
  /* Mirror editor: secondary button uses block.secondaryColor with fallback to branding.secondary_color */
  const secondaryBg = block.secondaryColor ?? branding.secondary_color
  const radius = block.buttonRadius ?? branding.button_radius
  const primaryText = primaryLabel ?? block.primary
  const secondaryText = secondaryLabel === undefined ? block.secondary : secondaryLabel

  // Resolve variant and size from block or global defaults.
  const variant = block.variant ?? branding.button_variant
  const size = block.size ?? branding.button_size

  // Size presets: padding and font size based on size value.
  const sizeMap = {
    sm: { padY: '0.5rem', fontSize: 13 },
    md: { padY: '0.875rem', fontSize: 14 },
    lg: { padY: '1rem', fontSize: 15 },
  }
  const sizeConfig = sizeMap[size]

  const primaryDefaults: TextStyleDefaults = {
    fontFamily: branding.font_body,
    fontSize: sizeConfig.fontSize,
    fontWeight: 500,
    color: variant === 'outline' ? buttonColor : getTextColor(buttonColor),
    align: 'center',
    lineHeight: 1.4,
    letterSpacing: 0,
  }
  const secondaryDefaults: TextStyleDefaults = {
    fontFamily: branding.font_body,
    fontSize: sizeConfig.fontSize,
    fontWeight: 500,
    color: branding.text_color || '#374151',
    align: 'center',
    lineHeight: 1.4,
    letterSpacing: 0,
  }

  return (
    <div className={`${p.docX} ${p.blockY} flex gap-3`}>
      <button
        type="button"
        disabled={primaryDisabled || primaryLoading}
        onClick={onPrimary}
        className={`flex-1 cursor-pointer hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed ${
          variant === 'outline' ? 'border border-current' : ''
        }`}
        style={{
          borderRadius: radius,
          background: variant === 'fill' ? buttonColor : 'transparent',
          paddingTop: sizeConfig.padY,
          paddingBottom: sizeConfig.padY,
          ...resolveTextStyle(block.primaryStyle, primaryDefaults),
        }}
      >
        {slots?.primary ? (
          slots.primary
        ) : primaryLoading ? (
          'Processing…'
        ) : primaryLabel !== undefined ? (
          primaryText
        ) : (
          <Html value={primaryText} allowLists={false} />
        )}
      </button>
      {secondaryText !== null && (
        <button
          type="button"
          disabled={primaryLoading}
          onClick={onSecondary}
          className="border cursor-pointer hover:opacity-90 transition disabled:opacity-50"
          style={{
            borderRadius: radius,
            // Mirror the editor: the secondary button keeps its secondaryBg fill
            // regardless of variant, and uses secondaryBg as the border on outline.
            background: secondaryBg,
            borderColor: variant === 'outline' ? secondaryBg : '#E5E7EB',
            paddingTop: sizeConfig.padY,
            paddingBottom: sizeConfig.padY,
            paddingLeft: '1.5rem',
            paddingRight: '1.5rem',
            ...resolveTextStyle(block.secondaryStyle, secondaryDefaults),
          }}
        >
          {slots?.secondary ? (
            slots.secondary
          ) : secondaryLabel !== undefined ? (
            secondaryText
          ) : (
            <Html value={secondaryText} allowLists={false} />
          )}
        </button>
      )}
    </div>
  )
}

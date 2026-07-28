'use client'

import { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle, type TextStyleDefaults } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { ActionBlock } from '@/app/(dashboard)/branding/blocks/types'

import { getTextColor } from '../contrast'
import type { PublicBranding } from '../public-surface'

import { Html } from './html'
import { pad, type ActionSlotProps } from './shared'

/**
 * Editor slots for customizing button text content.
 * Allows the editor to inject InlineText components for live editing of button labels.
 */
export interface ActionSlots {
  /** Editor replaces static primary button text with live InlineText. */
  primary?: ReactNode
  /** Editor replaces static secondary button text with live InlineText. */
  secondary?: ReactNode
  /** Editor replaces the instruction note above the buttons with live InlineText. */
  note?: ReactNode
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
    // Text sits ON the secondary fill, so it must use the secondary text
    // token; text_color here made dark-on-dark labels invisible.
    color: getTextColor(secondaryBg),
    align: 'center',
    lineHeight: 1.4,
    letterSpacing: 0,
  }

  const justifyClass = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
  }[block.buttonJustify ?? 'center']

  // Optional instruction above the buttons (e.g. "Pay securely online with your
  // card"). Editable in the editor via the note slot; on the sent document it
  // renders only when the MC wrote one.
  const noteDefaults: TextStyleDefaults = {
    fontFamily: branding.font_body,
    fontSize: 14,
    fontWeight: 400,
    color: branding.text_color,
    align: 'center',
    lineHeight: 1.5,
    letterSpacing: 0,
  }
  const noteCss = resolveTextStyle(block.noteStyle, noteDefaults)
  const noteNode =
    slots?.note !== undefined ? (
      <p data-subtarget="note" className="mb-3" style={noteCss}>{slots.note}</p>
    ) : block.note ? (
      <p data-subtarget="note" className="mb-3" style={noteCss}>{block.note}</p>
    ) : null

  return (
    <div className={`${p.docX} ${p.blockY}`}>
      {noteNode}
      <div className={`flex flex-col gap-2 @sm/doc:flex-row @sm/doc:gap-3 ${justifyClass}`}>
      <button
        type="button"
        data-subtarget="primary"
        disabled={primaryDisabled || primaryLoading}
        onClick={onPrimary}
        className={`cursor-pointer hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed w-full ${
          block.primaryWidthPx === undefined ? '@sm/doc:flex-1' : ''
        } ${variant === 'outline' ? 'border border-current' : ''}`}
        style={{
          borderRadius: radius,
          background: variant === 'fill' ? buttonColor : 'transparent',
          paddingTop: sizeConfig.padY,
          paddingBottom: sizeConfig.padY,
          ...(block.primaryWidthPx !== undefined ? { width: '100%', maxWidth: block.primaryWidthPx } : {}),
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
          data-subtarget="secondary"
          disabled={primaryLoading}
          onClick={onSecondary}
          className={`border cursor-pointer hover:opacity-90 transition disabled:opacity-50 w-full ${
            block.secondaryWidthPx === undefined ? '@sm/doc:w-auto' : ''
          }`}
          style={{
            borderRadius: radius,
            // Mirror the editor: the secondary button keeps its secondaryBg fill
            // regardless of variant, and uses secondaryBg as the border on outline.
            background: secondaryBg,
            borderColor: variant === 'outline' ? secondaryBg : branding.border_color,
            paddingTop: sizeConfig.padY,
            paddingBottom: sizeConfig.padY,
            paddingLeft: '1.5rem',
            paddingRight: '1.5rem',
            ...(block.secondaryWidthPx !== undefined ? { width: '100%', maxWidth: block.secondaryWidthPx } : {}),
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
    </div>
  )
}

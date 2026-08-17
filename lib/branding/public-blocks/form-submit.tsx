'use client'

// eslint-disable-next-line no-restricted-imports
import type { FormSubmitBlock } from '@/app/(dashboard)/branding/blocks/types'

import { getTextColor } from '../contrast'
import { bodyFontFamily, type PublicBranding } from '../public-surface'

import { pad } from './shared'

/**
 * The Website form's submit button, styled like the action block's primary
 * button: block-level overrides (colour, radius, variant, size, width) fall
 * back to the brand's global button settings, so the button matches the MC's
 * other branded CTAs by default and is stylable per block on top.
 *
 * Shared between the editor canvas preview (static, `disabled`) and the live
 * public form (`type="submit"`), so the two can never drift apart.
 *
 * @module lib/branding/public-blocks/form-submit
 */
export function RenderFormSubmitButton({
  block,
  branding,
  disabled = false,
  submitting = false,
  asSubmit = false,
}: {
  block: FormSubmitBlock
  branding: PublicBranding
  /** Disables the button (public: unmet required fields; editor: always). */
  disabled?: boolean
  /** Dims the button while the public form is posting. Label stays put. */
  submitting?: boolean
  /** Renders type="submit" for the live form; the editor keeps type="button". */
  asSubmit?: boolean
}) {
  const buttonColor = block.buttonColor ?? branding.brand_color
  const radius = block.buttonRadius ?? branding.button_radius
  const variant = block.variant ?? branding.button_variant
  const size = block.size ?? branding.button_size

  // Same size presets as the action block's buttons.
  const sizeMap = {
    sm: { padY: '0.5rem', fontSize: 13 },
    md: { padY: '0.875rem', fontSize: 14 },
    lg: { padY: '1rem', fontSize: 15 },
  }
  const sizeConfig = sizeMap[size]

  const justifyClass = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
  }[block.buttonJustify ?? 'start']

  return (
    // Vertical rhythm lives inside each public block (see BlockOuter), so the
    // submit block carries the density blockY itself, editor and public alike.
    <div className={`${pad(branding).blockY} flex ${justifyClass}`}>
      <button
        type={asSubmit ? 'submit' : 'button'}
        disabled={disabled || submitting}
        className={`cursor-pointer hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed ${
          variant === 'outline' ? 'border border-current' : ''
        }`}
        style={{
          borderRadius: radius,
          background: variant === 'fill' ? buttonColor : 'transparent',
          color: variant === 'outline' ? buttonColor : getTextColor(buttonColor),
          paddingTop: sizeConfig.padY,
          paddingBottom: sizeConfig.padY,
          paddingLeft: '1.5rem',
          paddingRight: '1.5rem',
          fontFamily: bodyFontFamily(branding),
          fontSize: sizeConfig.fontSize,
          fontWeight: 500,
          lineHeight: 1.4,
          ...(block.widthPx !== undefined ? { width: '100%', maxWidth: block.widthPx } : {}),
        }}
      >
        {block.label || 'Send enquiry'}
      </button>
    </div>
  )
}

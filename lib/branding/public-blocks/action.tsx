'use client'

import { resolveTextStyle, type TextStyleDefaults } from '@/app/(dashboard)/branding/blocks/text-style'
import type { ActionBlock } from '@/app/(dashboard)/branding/blocks/types'
import { getTextColor } from '../contrast'
import type { PublicBranding } from '../public-surface'
import { pad, type ActionSlotProps } from './shared'
import { Html } from './html'

export function RenderAction({
  block,
  branding,
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
} & ActionSlotProps) {
  if (hideAction) return null
  const p = pad(branding)
  const buttonColor = block.buttonColor ?? branding.brand_color
  const radius = block.buttonRadius ?? Math.min(branding.corner_radius, 12)
  const primaryText = primaryLabel ?? block.primary
  const secondaryText = secondaryLabel === undefined ? block.secondary : secondaryLabel

  const primaryDefaults: TextStyleDefaults = {
    fontFamily: branding.font_body,
    fontSize: 14,
    fontWeight: 500,
    color: getTextColor(buttonColor),
    align: 'center',
    lineHeight: 1.4,
    letterSpacing: 0,
  }
  const secondaryDefaults: TextStyleDefaults = {
    fontFamily: branding.font_body,
    fontSize: 14,
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
        className="flex-1 py-3.5 cursor-pointer hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          borderRadius: radius,
          background: buttonColor,
          ...resolveTextStyle(block.primaryStyle, primaryDefaults),
        }}
      >
        {primaryLoading ? (
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
          className="px-6 py-3.5 border border-gray-200 cursor-pointer hover:bg-gray-50 transition disabled:opacity-50"
          style={{ borderRadius: radius, ...resolveTextStyle(block.secondaryStyle, secondaryDefaults) }}
        >
          {secondaryLabel !== undefined ? secondaryText : <Html value={secondaryText} allowLists={false} />}
        </button>
      )}
    </div>
  )
}

'use client'

import { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle, type TextStyleDefaults } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { FooterBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../public-surface'

import { Html } from './html'
import { pad } from './shared'

export interface FooterSlots {
  /** Editor replaces static closing note with live InlineText. */
  note?: ReactNode
}

export function RenderFooter({
  block,
  branding,
  slots,
  chrome,
}: {
  block: FooterBlock
  branding: PublicBranding
  slots?: FooterSlots
  chrome?: ReactNode
}) {
  const p = pad(branding)
  const noteDefaults: TextStyleDefaults = {
    fontFamily: branding.font_body,
    fontSize: 12,
    fontWeight: branding.font_body_weight,
    color: branding.muted_color || '#6B7280',
    align: 'left',
    lineHeight: 1.5,
    letterSpacing: 0,
  }
  const contactDefaults: TextStyleDefaults = {
    fontFamily: branding.font_body,
    fontSize: 11,
    fontWeight: 400,
    color: branding.muted_color || '#9CA3AF',
    align: 'left',
    lineHeight: 1.5,
    letterSpacing: 0,
  }
  const noteCss = resolveTextStyle(block.noteStyle, noteDefaults)
  const contactCss = resolveTextStyle(block.contactStyle, contactDefaults)

  const contactParts = [
    branding.business_name,
    branding.phone,
    branding.website,
    branding.abn ? `ABN ${branding.abn}` : null,
  ].filter(Boolean) as string[]

  return (
    <div className={`${p.docX} ${p.blockY} mt-6 border-t border-gray-100 pt-5`}>
      <div className="space-y-1">
        {slots?.note ? <p style={noteCss}>{slots.note}</p> : block.closingNote ? (
          <p style={noteCss}>
            <Html value={block.closingNote} allowLists={false} />
          </p>
        ) : null}
        {contactParts.length > 0 && (
          <p className="flex flex-wrap gap-x-3 gap-y-1 justify-center" style={contactCss}>
            {contactParts.map((part, i) => (
              <span key={i}>
                {i > 0 && <span className="text-text-muted"> · </span>}
                <span className="whitespace-nowrap">{part}</span>
              </span>
            ))}
          </p>
        )}
      </div>
      {chrome}
    </div>
  )
}

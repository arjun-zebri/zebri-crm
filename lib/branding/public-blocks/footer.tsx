'use client'

import { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { FooterBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../public-surface'
import { roleDefaults } from '../type-defaults'

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
  const noteDefaults = roleDefaults(branding, 'body')
  const contactDefaults = roleDefaults(branding, 'finePrint')
  const noteCss = resolveTextStyle(block.noteStyle, noteDefaults)
  const contactCss = resolveTextStyle(block.contactStyle, contactDefaults)

  const contactParts = [
    branding.business_name,
    branding.phone,
    branding.website,
    branding.abn ? `ABN ${branding.abn}` : null,
  ].filter(Boolean) as string[]

  return (
    <div className={`${p.docX} ${p.blockY} mt-6 border-t pt-5`} style={{ borderTopColor: branding.border_color }}>
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
                {i > 0 && <span style={contactCss}> · </span>}
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

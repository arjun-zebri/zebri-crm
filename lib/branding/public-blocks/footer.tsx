'use client'

import { resolveTextStyle, type TextStyleDefaults } from '@/app/(dashboard)/branding/blocks/text-style'
import type { FooterBlock } from '@/app/(dashboard)/branding/blocks/types'
import type { PublicBranding } from '../public-surface'
import { pad } from './shared'
import { Html } from './html'

export function RenderFooter({
  block,
  branding,
}: {
  block: FooterBlock
  branding: PublicBranding
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
        {block.closingNote && (
          <p style={noteCss}>
            <Html value={block.closingNote} allowLists={false} />
          </p>
        )}
        {contactParts.length > 0 && <p style={contactCss}>{contactParts.join('  ·  ')}</p>}
      </div>
    </div>
  )
}

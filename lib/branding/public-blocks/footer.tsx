'use client'

import { resolveTextStyle, type TextStyleDefaults } from '@/app/(dashboard)/branding/blocks/text-style'
import type { FooterBlock } from '@/app/(dashboard)/branding/blocks/types'
import { FONT_STACKS } from '../fonts'
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
  const showMark = block.showMark ?? true

  const contactParts = [
    branding.business_name,
    branding.phone,
    branding.website,
    branding.abn ? `ABN ${branding.abn}` : null,
  ].filter(Boolean) as string[]

  return (
    <div className={`${p.docX} ${p.blockY} mt-6 border-t border-gray-100 pt-5`}>
      <div className="flex items-start gap-4">
        {showMark && (branding.logo_url || branding.favicon_url) ? (
          <img
            src={branding.logo_url || branding.favicon_url || ''}
            alt={branding.business_name || ''}
            className="w-6 h-6 object-contain rounded shrink-0"
          />
        ) : showMark ? (
          <div
            className="w-6 h-6 flex items-center justify-center text-white text-[10px] font-semibold shrink-0"
            style={{
              background: branding.brand_color,
              borderRadius: Math.min(branding.corner_radius, 6),
              fontFamily: FONT_STACKS[branding.font_heading],
            }}
          >
            {branding.business_name?.[0]?.toUpperCase() || 'Z'}
          </div>
        ) : null}
        <div className="min-w-0 flex-1 space-y-1">
          {block.closingNote && (
            <p style={noteCss}>
              <Html value={block.closingNote} allowLists={false} />
            </p>
          )}
          {contactParts.length > 0 && <p style={contactCss}>{contactParts.join('  ·  ')}</p>}
        </div>
      </div>
    </div>
  )
}

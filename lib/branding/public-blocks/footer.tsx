'use client'

import { ReactNode } from 'react'
import { Facebook, Instagram, Twitter, Pin, Globe } from 'lucide-react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle, caseText } from '@/app/(dashboard)/branding/blocks/text-style'
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

  // Each contact-line item is individually toggleable from the footer toolbar.
  // Undefined defaults to shown, so existing footers keep their full contact line.
  const contactParts = [
    (block.showBusinessName ?? true) ? branding.business_name : null,
    (block.showPhone ?? true) ? branding.phone : null,
    (block.showContactWebsite ?? true) ? branding.website : null,
    (block.showAbn ?? true) && branding.abn ? `ABN ${branding.abn}` : null,
  ].filter(Boolean) as string[]

  // Social networks: render icons for toggled-on networks with URLs.
  // Pin is used for Pinterest since Lucide has no Pinterest glyph.
  const NETWORKS = [
    { key: 'showFacebook' as const, url: branding.facebook_url, Icon: Facebook, label: 'Facebook' },
    { key: 'showInstagram' as const, url: branding.instagram_url, Icon: Instagram, label: 'Instagram' },
    { key: 'showTwitter' as const, url: branding.twitter_url, Icon: Twitter, label: 'Twitter' },
    { key: 'showPinterest' as const, url: branding.pinterest_url, Icon: Pin, label: 'Pinterest' },
    { key: 'showWebsite' as const, url: branding.website_url, Icon: Globe, label: 'Website' },
  ] as const
  const socialLinks = NETWORKS.filter((n) => block[n.key] && n.url)

  // When a closing note is shown, give the contact line a clear gap beneath it
  // (matching the social row's rhythm) so the note reads as its own line.
  const showNote = Boolean(slots?.note || block.closingNote)

  return (
    <div className={`${p.docX} ${p.blockY} mt-6 border-t pt-5`} style={{ borderTopColor: branding.border_color }}>
      <div className="space-y-1">
        {slots?.note ? <p style={noteCss}>{slots.note}</p> : block.closingNote ? (
          <p style={noteCss}>
            <Html value={block.closingNote} allowLists={false} />
          </p>
        ) : null}
        {contactParts.length > 0 && (
          <p className={`${showNote ? 'mt-3' : ''} flex flex-wrap gap-x-3 gap-y-1 justify-center`} style={contactCss}>
            {contactParts.map((part, i) => (
              <span key={i}>
                {i > 0 && <span style={contactCss}>{caseText(' · ', block.contactStyle, contactDefaults)}</span>}
                <span className="whitespace-nowrap">{caseText(part, block.contactStyle, contactDefaults)}</span>
              </span>
            ))}
          </p>
        )}
        {socialLinks.length > 0 && (
          <div className="mt-3 flex items-center gap-3 justify-center">
            {socialLinks.map(({ url, Icon, label }) => (
              <a
                key={label}
                href={url!}
                aria-label={label}
                target="_blank"
                rel="noreferrer"
                className="text-text-muted hover:text-text cursor-pointer"
              >
                <Icon size={18} strokeWidth={1.5} />
              </a>
            ))}
          </div>
        )}
      </div>
      {chrome}
    </div>
  )
}

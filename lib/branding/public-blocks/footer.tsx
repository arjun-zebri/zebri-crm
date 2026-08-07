'use client'

import { Facebook, Instagram, Twitter, Pin } from 'lucide-react'
import { ReactNode, type CSSProperties } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle, caseText } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { FooterBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../public-surface'
import { renderRichText, richContentToPlainText } from '../render-rich-text'
import { roleDefaults } from '../type-defaults'

import { HintBubble } from './hint-bubble'
import { pad } from './shared'
import { VarChip } from './var-chip'

export interface FooterSlots {
  /** Editor replaces the static closing note with the live RichText editor. */
  note?: ReactNode
}

/**
 * Prepend https:// when a stored URL has no scheme. Without this a bare value like
 * "instagram.com/you" is treated as a relative path and resolves to the current
 * origin (e.g. localhost/instagram.com/you) instead of the real site.
 */
function withScheme(url: string): string {
  const u = url.trim()
  return /^https?:\/\//i.test(u) ? u : `https://${u}`
}

export function RenderFooter({
  block,
  branding,
  slots,
  variableValues,
  variablePreview = false,
  chrome,
}: {
  block: FooterBlock
  branding: PublicBranding
  slots?: FooterSlots
  /** Variable id -> display value map for resolving chips in the closing note. */
  variableValues?: Record<string, string>
  /** Editor-only: show blank contact fields as mint `{{ … }}` chips. */
  variablePreview?: boolean
  chrome?: ReactNode
}) {
  const p = pad(branding)
  const noteDefaults = roleDefaults(branding, 'body')
  const contactDefaults = roleDefaults(branding, 'finePrint')
  const noteCss = resolveTextStyle(block.noteStyle, noteDefaults)
  const contactCss = resolveTextStyle(block.contactStyle, contactDefaults)

  // Each contact-line item is individually toggleable from the footer toolbar.
  // Undefined defaults to shown. A toggled-on item with no data shows as a mint
  // chip in the editor (variablePreview) so the field is visible, and is simply
  // omitted on the sent document.
  const contactItems = [
    { show: block.showPhone ?? true, text: branding.phone || '', href: undefined as string | undefined, chip: 'Phone', hint: 'Your phone number, from Settings → Branding.' },
    { show: block.showContactWebsite ?? true, text: branding.website || '', href: branding.website ? withScheme(branding.website) : undefined, chip: 'Website', hint: 'Your website, from Settings → Branding.' },
    { show: block.showAbn ?? true, text: branding.abn ? `ABN ${branding.abn}` : '', href: undefined as string | undefined, chip: 'ABN', hint: 'Your ABN, from Settings → Branding.' },
  ].filter((i) => i.show && (variablePreview || i.text))

  // Social networks: render icons for toggled-on networks with URLs.
  // Pin is used for Pinterest since Lucide has no Pinterest glyph.
  const NETWORKS = [
    { key: 'showFacebook' as const, url: branding.facebook_url, Icon: Facebook, label: 'Facebook' },
    { key: 'showInstagram' as const, url: branding.instagram_url, Icon: Instagram, label: 'Instagram' },
    { key: 'showTwitter' as const, url: branding.twitter_url, Icon: Twitter, label: 'Twitter' },
    { key: 'showPinterest' as const, url: branding.pinterest_url, Icon: Pin, label: 'Pinterest' },
  ] as const
  // A toggled-on network with no URL shows a mint placeholder icon in the editor
  // (variablePreview) so the MC sees it's enabled and where the URL comes from,
  // matching the contact-line chips; it's omitted on the sent document.
  const socialLinks = NETWORKS.filter((n) => block[n.key] && (variablePreview || n.url))

  // Social row styling, adjusted from the toolbar when the icon row is selected:
  // gap between icons, and an optional chip (background + rounding) behind each.
  const socialGap = block.socialGap ?? 12
  const iconBg = block.socialIconBg
  const iconColor = block.socialIconColor
  const iconRadius = block.socialIconRadius ?? 8
  const iconChipClass = iconBg ? 'inline-flex items-center justify-center' : ''
  // Chip (bg + rounding) and/or a custom icon colour. Inline colour overrides the
  // default `text-text-muted` class. Undefined style when neither is customised.
  const iconChipStyle: CSSProperties | undefined =
    iconBg || iconColor
      ? {
          ...(iconBg ? { backgroundColor: iconBg, borderRadius: iconRadius, padding: 6 } : {}),
          ...(iconColor ? { color: iconColor } : {}),
        }
      : undefined

  // When a closing note is shown, separate it from the contact/social block by a
  // configurable gap (default 12px) so the note reads as its own line.
  const showNote = Boolean(slots?.note || richContentToPlainText(block.closingNote))
  const noteGap = block.noteGap ?? 12

  return (
    <div className={`${p.blockY} mt-6 pt-5`}>
      {/* Rich text renders block-level <p>, so the container must be a <div>
          (a <p> here would nest <p>/<div> inside <p> and break hydration).
          Reset inner paragraph margins so a single note line keeps its spacing. */}
      {slots?.note ? <div style={noteCss} className="[&_p]:m-0">{slots.note}</div> : richContentToPlainText(block.closingNote) ? (
        <div style={noteCss} className="[&_p]:m-0" dangerouslySetInnerHTML={{ __html: renderRichText(block.closingNote, variableValues ?? {}) }} />
      ) : null}
      {(contactItems.length > 0 || socialLinks.length > 0) && (
        <div className="space-y-3" style={showNote ? { marginTop: noteGap } : undefined}>
          {contactItems.length > 0 && (
            <p data-subtarget="contact" className="flex flex-wrap gap-x-3 gap-y-1 justify-center" style={contactCss}>
              {contactItems.map((item, i) => (
                <span key={i} className="inline-flex items-baseline">
                  {i > 0 && <span style={contactCss}>{caseText(' · ', block.contactStyle, contactDefaults)}</span>}
                  <span className="whitespace-nowrap">
                    {item.text ? (
                      // Link on the sent document; plain text in the editor so it
                      // stays selectable/styleable and doesn't navigate on click.
                      item.href && !variablePreview ? (
                        <a href={item.href} target="_blank" rel="noreferrer" className="hover:underline cursor-pointer">
                          {caseText(item.text, block.contactStyle, contactDefaults)}
                        </a>
                      ) : (
                        caseText(item.text, block.contactStyle, contactDefaults)
                      )
                    ) : (
                      <VarChip label={item.chip} hint={item.hint} />
                    )}
                  </span>
                </span>
              ))}
            </p>
          )}
          {socialLinks.length > 0 && (
            <div data-subtarget="social" className="flex items-center justify-center" style={{ gap: socialGap }}>
              {socialLinks.map(({ url, Icon, label }) =>
                url ? (
                  // In the editor (variablePreview) render a non-navigating span so
                  // clicking selects the icon row; on the sent document render the
                  // real link. Both wear the optional chip (background + rounding).
                  variablePreview ? (
                    <span
                      key={label}
                      aria-label={label}
                      className={`text-text-muted ${iconChipClass}`}
                      style={iconChipStyle}
                    >
                      <Icon size={18} strokeWidth={1.5} />
                    </span>
                  ) : (
                    <a
                      key={label}
                      href={withScheme(url)}
                      aria-label={label}
                      target="_blank"
                      rel="noreferrer"
                      className={`text-text-muted hover:text-text cursor-pointer ${iconChipClass}`}
                      style={iconChipStyle}
                    >
                      <Icon size={18} strokeWidth={1.5} />
                    </a>
                  )
                ) : (
                  // Placeholder: enabled but no URL set yet. Mint like the contact
                  // chips, with a hint pointing at where the URL comes from.
                  <span
                    key={label}
                    className="relative group/vh inline-flex items-center rounded-control p-0.5 cursor-help"
                    style={{ backgroundColor: '#D1FAE5', color: '#047857' }}
                  >
                    <Icon size={18} strokeWidth={1.5} />
                    <HintBubble hint={`Your ${label} link, from Settings → Branding.`} />
                  </span>
                )
              )}
            </div>
          )}
        </div>
      )}
      {chrome}
    </div>
  )
}

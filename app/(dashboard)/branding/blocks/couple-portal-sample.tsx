import { LayoutDashboard, Clock, Users2, Receipt, FileSignature, Music, FileText } from 'lucide-react'

import { pillForeground } from '@/lib/branding/contrast'
import { FONT_STACKS } from '@/lib/branding/fonts'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { roleDefaults } from '@/lib/branding/type-defaults'

import { resolveTextStyle } from './text-style'
import type { TextStyle } from './types'

/**
 * Portal-scoped typography overrides for the four sample tiers, mirroring the
 * `couplePortal` block's `titleStyle` / `subtitleStyle` / `headingStyle` /
 * `bodyStyle`. Each is optional; an unset target renders the historical default.
 */
export interface PortalSampleStyles {
  title?: TextStyle | undefined
  subtitle?: TextStyle | undefined
  heading?: TextStyle | undefined
  body?: TextStyle | undefined
}

const SAMPLE_SECTIONS: Array<{ label: string; icon: typeof LayoutDashboard; count: number; active?: boolean; key?: string }> = [
  { label: 'Overview', icon: LayoutDashboard, count: 1, active: true },
  { label: 'Timeline', icon: Clock, count: 12, key: 'timeline' },
  { label: 'Contacts', icon: Users2, count: 8, key: 'contacts' },
  { label: 'Payments', icon: Receipt, count: 2, key: 'payments' },
  { label: 'Contracts', icon: FileSignature, count: 1, key: 'contracts' },
  { label: 'Songs', icon: Music, count: 18, key: 'songs' },
  { label: 'Files', icon: FileText, count: 3, key: 'files' },
]

/**
 * Representative, non-interactive sample of the couple portal (hero + section
 * nav + Overview cards), used both in the branding editor's `couplePortal` mock
 * and the branding preview. The four styled tiers carry `data-subtarget` tags so
 * a click in the editor targets the matching typography control.
 *
 * Legacy safety: each tier resolves its portal-scoped override over defaults
 * built from the values the real portal hero / `PortalShell` currently hard-code
 * (the element's current colour, `letterSpacing: 0`, `textTransform: 'none'`),
 * so a portal with no overrides reads exactly like the sent portal.
 *
 * @param branding - Resolved public branding (colours, fonts, type scale).
 * @param portalSections - Which optional nav sections are enabled; omit to show all.
 * @param styles - Portal-scoped typography overrides for the four tiers.
 */
export function CouplePortalSample({
  branding,
  portalSections,
  styles,
}: {
  branding: PublicBranding
  portalSections?: Partial<Record<string, boolean>> | null | undefined
  styles?: PortalSampleStyles
}) {
  const headingFontCss = { fontFamily: FONT_STACKS[branding.font_heading], fontWeight: branding.font_weight }
  // Cards follow the branding surface + border, exactly like the real portal
  // sections (which use `branding.surface_color`) — so setting the background
  // colour includes these cards instead of leaving them stuck white.
  const cardStyle = { backgroundColor: branding.surface_color, borderColor: branding.border_color }
  const visibleSections = SAMPLE_SECTIONS.filter(
    (s) => !s.key || portalSections?.[s.key] !== false,
  )

  // Colour-preserving defaults: the hero couple-name + intro both render in the
  // text colour today; the section heading + subtitle use their role colours.
  // Forcing letterSpacing 0 + textTransform none reproduces the current inline
  // styles (which set neither), so an un-overridden portal is byte-identical.
  const titleCss = resolveTextStyle(styles?.title, {
    ...roleDefaults(branding, 'docTitle'),
    color: branding.text_color,
    letterSpacing: 0,
    textTransform: 'none',
  })
  const subtitleCss = resolveTextStyle(styles?.subtitle, {
    ...roleDefaults(branding, 'body'),
    color: branding.text_color,
    letterSpacing: 0,
    textTransform: 'none',
  })
  const headingCss = resolveTextStyle(styles?.heading, {
    ...roleDefaults(branding, 'sectionHeading'),
    letterSpacing: 0,
    textTransform: 'none',
  })
  const bodyCss = resolveTextStyle(styles?.body, {
    ...roleDefaults(branding, 'body'),
    letterSpacing: 0,
    textTransform: 'none',
  })

  return (
    <div>
      <div className="pt-2 pb-6 border-b border-gray-100">
        <p data-subtarget="title" className="mb-1" style={titleCss}>
          Couple name
        </p>
        <p data-subtarget="subtitle" className="mt-3" style={subtitleCss}>
          Fill in your details below. Everything saves automatically. You can come back anytime.
        </p>
      </div>
      <div className="flex flex-col @md/doc:flex-row gap-8 py-6 min-h-[420px]">
        <nav className="hidden @md/doc:flex w-52 shrink-0 border-r border-gray-100 pr-4 flex-col space-y-0.5">
          {visibleSections.map((s) => {
            const Icon = s.icon
            return (
              <div key={s.label} className={`flex items-center gap-3 px-3 py-2 rounded-control transition ${s.active ? 'bg-surface-emphasis text-text font-medium' : 'text-text-muted'}`}>
                <Icon size={15} strokeWidth={1.5} className="shrink-0" />
                <span className="flex-1 text-sm">{s.label}</span>
                <span className="text-[11px] text-text-subtle">{s.count}</span>
              </div>
            )
          })}
        </nav>
        <div className="w-full @md/doc:flex-1 @md/doc:min-w-0 space-y-6">
          <div>
            <h2 data-subtarget="heading" className="font-semibold" style={headingCss}>Overview</h2>
            <p data-subtarget="body" className="mt-1" style={bodyCss}>Your details and upcoming events</p>
          </div>
          <div className="border rounded-control p-6" style={cardStyle}>
            <p className="text-xs font-medium text-text-muted mb-4">Your details</p>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-[10px] text-text-subtle uppercase tracking-wider mb-1">Name</p><p className="text-lg font-semibold text-text" style={headingFontCss}>Alex &amp; Jordan</p></div>
              <div><p className="text-[10px] text-text-subtle uppercase tracking-wider mb-1">Email</p><p className="text-sm text-gray-700">hello@example.com</p></div>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-text-muted mb-2">Your events</p>
            <div className="border rounded-control p-5" style={cardStyle}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-medium text-text">Saturday, 14 September 2026</p>
                  <p className="text-sm text-text-muted mt-0.5">The Glasshouse, Sydney</p>
                </div>
                <span className="shrink-0 text-xs px-2.5 py-1 font-medium rounded-pill whitespace-nowrap" style={{ background: `${branding.brand_color}26`, color: pillForeground(branding.brand_color, branding.brand_color, branding.surface_color) }}>127 days away</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded-control p-5" style={cardStyle}><p className="text-[10px] text-text-subtle uppercase tracking-wider mb-2">Next payment</p><p className="text-lg font-semibold text-text" style={headingFontCss}>$1,250</p><p className="text-xs text-text-muted mt-1">Due 1 August 2026</p></div>
            <div className="border rounded-control p-5" style={cardStyle}><p className="text-[10px] text-text-subtle uppercase tracking-wider mb-2">Contract</p><p className="text-lg font-semibold text-text" style={headingFontCss}>Signed</p><p className="text-xs text-text-muted mt-1">12 April 2026</p></div>
          </div>
        </div>
      </div>
    </div>
  )
}

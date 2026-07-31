import { createServerClient } from '@supabase/ssr'
import { headers } from 'next/headers'
import Image from 'next/image'
import { notFound } from 'next/navigation'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { recordInvalidTokenAttempt } from '@/lib/api/public-token-limiter'
import { ipOfHeaders } from '@/lib/api/rate-limit'
import { DENSITY_PADDING } from '@/lib/branding/density'
import {
  FONT_STACKS,
  type BodyFont,
  type HeadingFont,
} from '@/lib/branding/fonts'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import { PublicBlockRenderer, type PublicDocData } from '@/lib/branding/public-renderer'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { roleDefaults } from '@/lib/branding/type-defaults'
import { repairBlocks } from '@/lib/branding/validate-blocks'


import { BrandingHead } from './branding-head'
import { PortalShell } from './portal-shell'

export interface PortalPerson {
  id: string
  category: 'partner' | 'bridal_party' | 'family' | 'other'
  full_name: string
  phonetic: string | null
  role: string | null
  audio_url: string | null
  position: number
  notes: string | null
  email: string | null
  phone: string | null
}

export interface PortalSong {
  id: string
  category: string
  title: string
  artist: string | null
  notes: string | null
  position: number
}

export interface PortalFile {
  id: string
  name: string
  file_url: string
  file_size: number | null
  created_at: string
}

export interface PortalTimelineItem {
  id: string
  start_time: string | null
  title: string
  description: string | null
  duration_min: number | null
  position: number
  pending_review: boolean
  /**
   * The event this moment belongs to. A couple can have several events
   * (and several on the same day); the Timeline section groups items by
   * the event's date so each day shows as its own run sheet.
   */
  event_id: string
}

export interface PortalEvent {
  id: string
  date: string
  venue: string | null
  status: string
}

export interface PortalContact {
  id: string
  name: string
  category: string | null
  email: string | null
  phone: string | null
}

export interface PortalInvoice {
  id: string
  title: string
  invoice_number: string
  status: string
  subtotal: number
  due_date: string | null
  share_token: string | null
  share_token_enabled: boolean
}

export interface PortalContract {
  id: string
  title: string
  contract_number: string
  status: string
  share_token: string | null
  share_token_enabled: boolean
  email_sent_at: string | null
  signed_at: string | null
}

export interface PortalQuestionnaire {
  id: string
  title: string
  status: string
  share_token: string | null
  share_token_enabled: boolean
  sent_at: string | null
  completed_at: string | null
}

export interface PortalSongCategory {
  key: string
  label: string
  description: string | null
  position: number
}

export interface PortalVow {
  id: string
  who: string
  content: string
}

export interface PortalData {
  couple_id: string
  couple_name: string
  couple_email: string | null
  /**
   * Which partner this link belongs to. Derived server-side from the
   * token (primary `portal_token` → 'primary', `secondary_portal_token`
   * → 'spouse'). Drives the Vows section's own-vow-only view.
   */
  viewer: 'primary' | 'spouse'
  /** Primary partner's display name (for vow labels / the partner note). */
  primary_name: string | null
  /** Primary partner's email - editable from the Overview tab. */
  primary_email: string | null
  /** Primary partner's phone - editable from the Overview tab. */
  primary_phone: string | null
  /** Secondary partner's display name. */
  secondary_name: string | null
  /** Secondary partner's email - editable from the Overview tab. */
  secondary_email: string | null
  /** Secondary partner's phone - editable from the Overview tab. */
  secondary_phone: string | null
  event: { id: string; date: string; venue: string } | null
  events: PortalEvent[]
  people: PortalPerson[]
  contacts: PortalContact[]
  songs: PortalSong[]
  song_categories: PortalSongCategory[]
  files: PortalFile[]
  vows: PortalVow[]
  timeline_items: PortalTimelineItem[]
  payments: {
    invoices: PortalInvoice[]
  }
  contracts: PortalContract[]
  questionnaires: PortalQuestionnaire[]
  enabled_sections: string[] | null
  branding: PublicBranding | null
  branding_blocks: Block[] | null
}

const PORTAL_DOC: PublicDocData = { title: '', refNumber: '', expiresAt: null, items: [], subtotal: 0, taxRate: 0 }

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )

  const { data } = await supabase.rpc('get_portal_data', { token })
  const portal = data as PortalData | null

  if (!portal) {
    // Token-attempt limiter - record this invalid attempt by IP so
    // bursts (10+ in 60s) fire a Slack alert and sustained scanning
    // (60+ in an hour) starts returning notFound() instead of the
    // friendly "not active" copy. Same protection model as
    // /invoice/[token] / /quote/[token] surfaces.
    const ip = ipOfHeaders(await headers())
    const result = await recordInvalidTokenAttempt({ ip, surface: 'portal' })
    if (!result.allowed) {
      notFound()
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-6" style={{ backgroundColor: '#fafafa' }}>
        <Image src="/zebri-logo.svg" alt="Zebri" width={80} height={29} />
        <p className="text-sm text-text-muted">{/* gate-allow: pre-branding state */}This link is not active.</p>
        <p className="text-xs text-text-subtle text-center max-w-xs">{/* gate-allow: pre-branding state */}
          Contact your MC to activate your portal link.
        </p>
      </div>
    )
  }

  // Questionnaires live in their own lightweight RPC (keeps the large
  // get_portal_data payload untouched). Attach them to the portal object the
  // shell already consumes.
  const { data: qData } = await supabase.rpc('get_portal_questionnaires', { token })
  portal.questionnaires = (qData as PortalQuestionnaire[] | null) ?? []

  // Resolve branding once at the page boundary. portal.branding comes from
  // get_portal_data which always returns a fully populated PublicBranding
  // (coalesced to Minimal defaults server-side). The null-coalesce here is
  // defensive: in normal operation it is never null.
  const branding: PublicBranding = portal.branding ?? buildPublicBranding({})
  const pageBg = branding.surface_color
  const textColor = branding.text_color
  const mutedColor = branding.text_color
  const headingFont = (branding.font_heading || 'inter') as HeadingFont
  const bodyFont = (branding.font_body || 'inter') as BodyFont
  const headingStack = FONT_STACKS[headingFont]
  const bodyStack = FONT_STACKS[bodyFont]
  const headingWeight = branding.font_weight ?? 600
  // The businessName block renders with this horizontal padding; match it on the
  // hero so the couple name lines up with the logo/business name above it.
  const docX = (DENSITY_PADDING[branding.density ?? 'cozy'] ?? DENSITY_PADDING.cozy).docX

  // The couplePortal block is a placeholder for the real portal (hero + section
  // nav). Split the saved blocks around it so blocks the MC placed above it
  // render before the portal and blocks placed below render after - matching
  // the branding editor's order. No couplePortal marker (legacy) → all blocks
  // render before the portal.
  const allBlocks = portal.branding_blocks && portal.branding_blocks.length > 0
    ? repairBlocks('portal', portal.branding_blocks)
    : []
  const hasBlocks = allBlocks.length > 0 && !!branding
  const cpIdx = allBlocks.findIndex((b) => b.type === 'couplePortal')
  const preBlocks = cpIdx >= 0 ? allBlocks.slice(0, cpIdx) : allBlocks
  const postBlocks = cpIdx >= 0 ? allBlocks.slice(cpIdx + 1) : []

  return (
    <div
      className="min-h-screen"
      style={{ background: pageBg, color: textColor, fontFamily: bodyStack }}
    >
      <BrandingHead branding={branding} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-20 @container/doc">

        {hasBlocks && branding ? (
          preBlocks.length > 0 && (
            <div className="pt-6"><PublicBlockRenderer blocks={preBlocks} branding={branding} doc={PORTAL_DOC} /></div>
          )
        ) : (
          <>
            {branding.header_image_url && (
              <div className="pt-6">
                <div
                  className="overflow-hidden"
                  style={{ borderRadius: branding.corner_radius ?? 16 }}
                >
                  <img
                    src={branding.header_image_url}
                    alt=""
                    className="block w-full h-44 sm:h-56 object-cover"
                  />
                </div>
              </div>
            )}

            <div className={`${docX} pt-10 pb-2 flex items-center gap-4`}>
              {branding.logo_url ? (
                <img
                  src={branding.logo_url}
                  alt={branding.business_name || 'Logo'}
                  className="object-contain rounded-lg shrink-0"
                  style={{
                    width: 48,
                    height: 48,
                    backgroundColor: branding.surface_color,
                    borderRadius: branding.corner_radius,
                  }}
                />
              ) : branding.favicon_url ? (
                <img
                  src={branding.favicon_url}
                  alt={branding.business_name || 'Logo'}
                  className="object-contain shrink-0"
                  style={{
                    width: 48,
                    height: 48,
                    backgroundColor: branding.surface_color,
                    borderRadius: branding.corner_radius,
                  }}
                />
              ) : (
                <div
                  className="flex items-center justify-center text-white font-semibold shrink-0"
                  style={{
                    width: 48,
                    height: 48,
                    background: branding.brand_color,
                    borderRadius: Math.min(branding.corner_radius, 12),
                    fontSize: 22,
                    fontFamily: headingStack,
                    fontWeight: headingWeight,
                  }}
                >
                  {branding.business_name?.[0]?.toUpperCase() || 'Z'}
                </div>
              )}
              {branding.business_name && (
                <div className="min-w-0">
                  <p
                    className="font-semibold truncate"
                    style={{ fontSize: `${roleDefaults(branding, 'sectionHeading').fontSize}px`, color: textColor, fontFamily: headingStack, fontWeight: headingWeight }}
                  >
                    {branding.business_name}
                  </p>
                  {branding.tagline && (
                    <p
                      className="truncate"
                      style={{
                        fontSize: '0.875rem',
                        color: mutedColor,
                        fontFamily: bodyStack,
                        fontWeight: 400,
                        lineHeight: '1.5',
                      }}
                    >
                      {branding.tagline}
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Hero */}
        <div
          className={`${docX} pt-8 pb-8 border-b`}
          style={{ borderColor: branding.border_color, borderBottomWidth: 1 }}
        >
          <h1
            className="mb-1"
            style={{ fontSize: `${roleDefaults(branding, 'docTitle').fontSize}px`, color: textColor, fontFamily: headingStack, fontWeight: headingWeight }}
          >
            {portal.couple_name}
          </h1>
          <p
            className="mt-3"
            style={{
              color: mutedColor,
              fontSize: `${roleDefaults(branding, 'body').fontSize}px`,
              fontFamily: FONT_STACKS[roleDefaults(branding, 'body').fontFamily as never],
              lineHeight: roleDefaults(branding, 'body').lineHeight,
            }}
          >
            Fill in your details below. Everything saves automatically. You can come back anytime.
          </p>
        </div>

        {/* Portal sections - same horizontal padding as the blocks/hero so the
            Overview nav lines up with the logo, couple name and intro. */}
        <div className={docX}>
          <PortalShell
            token={token}
            initialData={portal}
            branding={branding}
          />
        </div>

        {/* Blocks the MC placed below the couple portal in the editor. */}
        {hasBlocks && branding && postBlocks.length > 0 && (
          <div className="pt-6"><PublicBlockRenderer blocks={postBlocks} branding={branding} doc={PORTAL_DOC} /></div>
        )}

      </div>
    </div>
  )
}

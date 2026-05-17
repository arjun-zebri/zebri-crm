import Image from 'next/image'
import { createServerClient } from '@supabase/ssr'
import { PortalShell } from './portal-shell'
import { BrandingHead } from './branding-head'
import {
  FONT_STACKS,
  type HeadingFont,
  type BodyFont,
} from '@/lib/branding/fonts'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { DENSITY_PADDING } from '@/lib/branding/density'
import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { PublicBlockRenderer, type PublicDocData } from '@/lib/branding/public-renderer'

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

export interface PortalQuote {
  id: string
  title: string
  quote_number: string
  status: string
  subtotal: number
  share_token: string | null
  share_token_enabled: boolean
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

export interface PortalSongCategory {
  key: string
  label: string
  description: string | null
  position: number
}

export interface PortalData {
  couple_id: string
  couple_name: string
  couple_email: string | null
  event: { id: string; date: string; venue: string } | null
  events: PortalEvent[]
  people: PortalPerson[]
  contacts: PortalContact[]
  songs: PortalSong[]
  song_categories: PortalSongCategory[]
  files: PortalFile[]
  timeline_items: PortalTimelineItem[]
  payments: {
    quotes: PortalQuote[]
    invoices: PortalInvoice[]
  }
  contracts: PortalContract[]
  enabled_sections: string[] | null
  branding: PublicBranding | null
  branding_blocks: Block[] | null
}

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
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
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 gap-6">
        <Image src="/zebri-logo.svg" alt="Zebri" width={80} height={29} />
        <p className="text-sm text-gray-500">This link is not active.</p>
        <p className="text-xs text-gray-400 text-center max-w-xs">
          Contact your MC to activate your portal link.
        </p>
      </div>
    )
  }

  const branding = portal.branding
  const pageBg = branding?.surface_color || '#ffffff'
  const textColor = branding?.text_color || '#111827'
  const mutedColor = branding?.muted_color || '#6B7280'
  const headingFont = (branding?.font_heading || 'inter') as HeadingFont
  const bodyFont = (branding?.font_body || 'inter') as BodyFont
  const headingStack = FONT_STACKS[headingFont]
  const bodyStack = FONT_STACKS[bodyFont]
  const headingWeight = branding?.font_weight ?? 600
  // The businessName block renders with this horizontal padding; match it on the
  // hero so the couple name lines up with the logo/business name above it.
  const docX = (DENSITY_PADDING[branding?.density ?? 'cozy'] ?? DENSITY_PADDING.cozy).docX

  // The couplePortal block is a placeholder for the real portal (hero + section
  // nav). Split the saved blocks around it so blocks the MC placed above it
  // render before the portal and blocks placed below render after — matching
  // the branding editor's order. No couplePortal marker (legacy) → all blocks
  // render before the portal.
  const allBlocks = portal.branding_blocks ?? []
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

      <div className="max-w-4xl mx-auto px-4 pb-20">

        {hasBlocks && branding ? (
          preBlocks.length > 0 && (
            <div className="pt-6"><PublicBlockRenderer blocks={preBlocks} branding={branding} doc={PORTAL_DOC} /></div>
          )
        ) : (
          <>
            {branding?.header_image_url && (
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
              {branding?.logo_url ? (
                <img
                  src={branding.logo_url}
                  alt={branding.business_name || 'Logo'}
                  className="object-contain rounded-lg bg-white shrink-0"
                  style={{ width: 48, height: 48 }}
                />
              ) : branding?.favicon_url ? (
                <img
                  src={branding.favicon_url}
                  alt={branding.business_name || 'Logo'}
                  className="object-contain rounded-lg bg-white shrink-0"
                  style={{ width: 48, height: 48 }}
                />
              ) : (
                <div
                  className="flex items-center justify-center text-white font-semibold shrink-0"
                  style={{
                    width: 48,
                    height: 48,
                    background: branding?.brand_color || '#111827',
                    borderRadius: Math.min(branding?.corner_radius ?? 12, 12),
                    fontSize: 22,
                    fontFamily: headingStack,
                    fontWeight: headingWeight,
                  }}
                >
                  {branding?.business_name?.[0]?.toUpperCase() || 'Z'}
                </div>
              )}
              {branding?.business_name && (
                <div className="min-w-0">
                  <p
                    className="text-base font-semibold truncate"
                    style={{ color: textColor, fontFamily: headingStack, fontWeight: headingWeight }}
                  >
                    {branding.business_name}
                  </p>
                  {branding.tagline && (
                    <p className="text-sm truncate" style={{ color: mutedColor }}>
                      {branding.tagline}
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Hero */}
        <div className={`${docX} pt-8 pb-8 border-b border-gray-200`}>
          <h1
            className="text-3xl mb-1"
            style={{ color: textColor, fontFamily: headingStack, fontWeight: headingWeight }}
          >
            {portal.couple_name}
          </h1>
          {portal.event && (
            <p className="text-sm" style={{ color: mutedColor }}>
              {formatEventDate(portal.event.date)}
              {portal.event.venue ? ` · ${portal.event.venue.replace(/\s*[—–]\s*/g, ', ')}` : ''}
            </p>
          )}
          <p className="mt-3 text-sm" style={{ color: mutedColor }}>
            Fill in your details below. Everything saves automatically. You can come back anytime.
          </p>
        </div>

        {/* Portal sections — same horizontal padding as the blocks/hero so the
            Overview nav lines up with the logo, couple name and intro. */}
        <div className={docX}>
          <PortalShell
            token={token}
            initialData={portal}
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

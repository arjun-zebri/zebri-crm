import { createServerClient } from '@supabase/ssr'
import Image from 'next/image'

import type { Block, VendorTimelineBodyBlock } from '@/app/(dashboard)/branding/blocks/types'
import { DOC_MAX_WIDTH_PX } from '@/lib/branding/document-frame'
import { FONT_STACKS, googleFontsHref, type BodyFont } from '@/lib/branding/fonts'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import { PublicBlockRenderer, type PublicDocData } from '@/lib/branding/public-renderer'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { roleDefaults } from '@/lib/branding/type-defaults'
import { repairBlocks } from '@/lib/branding/validate-blocks'
import { DEFAULT_VENDOR_ROLE } from '@/lib/branding/vendor-role'

import {
  VendorTimeline,
  type VendorEvent,
  type VendorTimelineItem,
} from './vendor-timeline'

/**
 * Vendor run sheet payload from get_vendor_timeline RPC.
 * Includes the couple's events, timeline items, and user branding.
 */
interface VendorData {
  events: VendorEvent[]
  timeline_items: VendorTimelineItem[]
  branding: PublicBranding | null
  branding_blocks: Block[] | null
}

export default async function VendorPage({
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

  const { data } = await supabase.rpc('get_vendor_timeline', { token })
  const vendorData = data as VendorData | null

  // Resolve branding once at the page boundary. vendorData.branding comes from
  // get_vendor_timeline which always returns a fully populated PublicBranding
  // (coalesced to Minimal defaults server-side). The null-coalesce here is
  // defensive: in normal operation it is never null.
  const branding: PublicBranding = vendorData?.branding ?? buildPublicBranding({})
  const pageBg = branding.surface_color
  const textColor = branding.text_color
  const mutedColor = branding.text_color
  const bodyFont = (branding.font_body || 'inter') as BodyFont
  const bodyStack = FONT_STACKS[bodyFont]

  // Repair block tree when present; split at vendorTimelineBody marker.
  // Pre-blocks render before the timeline, post-blocks render after.
  const allBlocks = vendorData?.branding_blocks && vendorData.branding_blocks.length > 0
    ? repairBlocks('vendorTimeline', vendorData.branding_blocks)
    : []
  const hasBlocks = allBlocks.length > 0 && !!branding
  const vtbIdx = allBlocks.findIndex((b) => b.type === 'vendorTimelineBody')
  const preBlocks = vtbIdx >= 0 ? allBlocks.slice(0, vtbIdx) : allBlocks
  const postBlocks = vtbIdx >= 0 ? allBlocks.slice(vtbIdx + 1) : []
  // Run-sheet-scoped typography overrides from the marker block, applied to the
  // live timeline. Absent block / no overrides ⇒ historical defaults (identical
  // render for every run sheet sent before this feature existed).
  const vtbBlock = vtbIdx >= 0 ? (allBlocks[vtbIdx] as VendorTimelineBodyBlock) : undefined
  const vtbStyles = vtbBlock
    ? { title: vtbBlock.titleStyle, subtitle: vtbBlock.subtitleStyle, body: vtbBlock.bodyStyle, note: vtbBlock.noteStyle }
    : undefined

  // Empty PublicDocData - used to render blocks without document-specific context.
  const VENDOR_DOC: PublicDocData = { title: '', refNumber: '', expiresAt: null, items: [], subtotal: 0, taxRate: 0 }

  if (!vendorData) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4 gap-6"
        style={{ background: pageBg, color: textColor, fontFamily: bodyStack }}
      >
        <Image src="/zebri-logo.svg" alt="Zebri" width={80} height={29} />
        <p className="text-sm" style={{ color: mutedColor }}>{/* gate-allow: pre-branding state */}This link is not active.</p>
        <p className="text-xs text-center max-w-xs" style={{ color: mutedColor }}>{/* gate-allow: pre-branding state */}
          Contact the person who sent you this link to activate it.
        </p>
      </div>
    )
  }

  if (vendorData.events.length === 0) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4 gap-6"
        style={{ background: pageBg, color: textColor, fontFamily: bodyStack }}
      >
        <Image src="/zebri-logo.svg" alt="Zebri" width={80} height={29} />
        <p
          style={{
            color: mutedColor,
            fontSize: `${roleDefaults(branding, 'body').fontSize}px`,
            fontFamily: FONT_STACKS[roleDefaults(branding, 'body').fontFamily as never],
          }}
        >
          No event scheduled yet.
        </p>
        <p
          className="text-center max-w-xs"
          style={{
            color: mutedColor,
            fontSize: `${roleDefaults(branding, 'finePrint').fontSize}px`,
            fontFamily: FONT_STACKS[roleDefaults(branding, 'finePrint').fontFamily as never],
          }}
        >
          The run sheet will appear here once the{' '}
          {branding.vendor_role || DEFAULT_VENDOR_ROLE} adds an event for this couple.
        </p>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: pageBg, color: textColor, fontFamily: bodyStack }}
    >
      {/* Apply Google Fonts link if branding specifies custom fonts. */}
      {branding?.font_heading && branding?.font_body && (
        <link rel="stylesheet" href={googleFontsHref([branding.font_heading, branding.font_body])} />
      )}

      <div className="mx-auto w-full px-4 pb-16 @container/doc" style={{ maxWidth: DOC_MAX_WIDTH_PX }}>

        {/* Pre-blocks: render above the timeline. */}
        {hasBlocks && branding && preBlocks.length > 0 && (
          <div className="pt-6"><PublicBlockRenderer blocks={preBlocks} branding={branding} doc={VENDOR_DOC} /></div>
        )}

        {/* Logo and timeline */}
        {!hasBlocks && (
          <div className="pt-10 pb-2">
            <Image src="/zebri-logo.svg" alt="Zebri" width={64} height={23} />
          </div>
        )}

        <VendorTimeline
          events={vendorData.events}
          items={vendorData.timeline_items}
          branding={branding}
          {...(vtbStyles ? { styles: vtbStyles } : {})}
        />

        {/* Post-blocks: render below the timeline. */}
        {hasBlocks && branding && postBlocks.length > 0 && (
          <div className="pt-6"><PublicBlockRenderer blocks={postBlocks} branding={branding} doc={VENDOR_DOC} /></div>
        )}

      </div>
    </div>
  )
}

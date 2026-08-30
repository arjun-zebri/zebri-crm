'use client'

/**
 * Print a couple's run sheet with the same branding blocks the vendor link
 * renders.
 *
 * Fetches through `get_vendor_timeline`, the RPC behind `/portal/[token]/vendor`,
 * so the print gets the identical events, items, branding scalars and block
 * tree. The previous printer read `timeline_items` directly and emitted a
 * system-font table with no logo, colours or fonts.
 *
 * Every day of a multi-day event prints in sequence (the public page shows
 * one day at a time behind a picker).
 *
 * @module components/print/print-run-sheet
 */

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import type { VendorTimelineBodyBlock } from '@/app/(dashboard)/branding/blocks/types'
import {
  VendorTimeline,
  type VendorEvent,
  type VendorTimelineItem,
} from '@/app/portal/[token]/vendor/vendor-timeline'
import type { PublicBranding } from '@/lib/branding/public-branding'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import { PublicBlockRenderer, type PublicDocData } from '@/lib/branding/public-renderer'
import { repairBlocks } from '@/lib/branding/validate-blocks'
import { printDocument } from '@/lib/pdf/print-document'
import { createClient } from '@/lib/supabase/client'


interface VendorData {
  events: VendorEvent[]
  timeline_items: VendorTimelineItem[]
  branding: PublicBranding | null
  branding_blocks: Block[] | null
}

/** Blocks render without document-specific context, as on the vendor page. */
const VENDOR_DOC: PublicDocData = {
  title: '',
  refNumber: '',
  expiresAt: null,
  items: [],
  subtotal: 0,
  taxRate: 0,
}

/** Compose the printable run sheet exactly as `/portal/[token]/vendor` does. */
export function runSheetPrintElement(data: VendorData) {
  const branding = data.branding ?? buildPublicBranding({})
  const all =
    data.branding_blocks && data.branding_blocks.length > 0
      ? repairBlocks('vendorTimeline', data.branding_blocks)
      : []
  const vtbIdx = all.findIndex((b) => b.type === 'vendorTimelineBody')
  const preBlocks = vtbIdx >= 0 ? all.slice(0, vtbIdx) : all
  const postBlocks = vtbIdx >= 0 ? all.slice(vtbIdx + 1) : []
  const vtb = vtbIdx >= 0 ? (all[vtbIdx] as VendorTimelineBodyBlock) : undefined
  const styles = vtb
    ? { title: vtb.titleStyle, subtitle: vtb.subtitleStyle, body: vtb.bodyStyle, note: vtb.noteStyle }
    : undefined

  return (
    <div className="print-card">
      {preBlocks.length > 0 ? (
        <div className="pt-6">
          <PublicBlockRenderer blocks={preBlocks} branding={branding} doc={VENDOR_DOC} />
        </div>
      ) : null}
      <VendorTimeline
        events={data.events}
        items={data.timeline_items}
        branding={branding}
        static
        {...(styles ? { styles } : {})}
      />
      {postBlocks.length > 0 ? (
        <div className="pt-6">
          <PublicBlockRenderer blocks={postBlocks} branding={branding} doc={VENDOR_DOC} />
        </div>
      ) : null}
    </div>
  )
}

/**
 * Print the run sheet for a couple.
 *
 * @param portalToken - The couple's `portal_token`, which `get_vendor_timeline`
 * resolves the couple, events, items and branding from.
 */
export async function printRunSheet(portalToken: string, coupleName: string): Promise<void> {
  const supabase = createClient()
  const { data } = await supabase.rpc('get_vendor_timeline', { token: portalToken })
  const vendor = (data ?? null) as VendorData | null
  if (!vendor) return

  printDocument({
    title: `Run sheet - ${coupleName}`,
    element: runSheetPrintElement(vendor),
    branding: vendor.branding,
  })
}

import Image from 'next/image'
import { createServerClient } from '@supabase/ssr'

import {
  VendorTimeline,
  type VendorEvent,
  type VendorTimelineItem,
} from './vendor-timeline'

interface VendorData {
  events: VendorEvent[]
  timeline_items: VendorTimelineItem[]
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

  if (!vendorData) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 gap-6">
        <Image src="/zebri-logo.svg" alt="Zebri" width={80} height={29} />
        <p className="text-sm text-gray-500">This link is not active.</p>
        <p className="text-xs text-gray-400 text-center max-w-xs">
          Contact the MC to activate the run sheet link.
        </p>
      </div>
    )
  }

  if (vendorData.events.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 gap-6">
        <Image src="/zebri-logo.svg" alt="Zebri" width={80} height={29} />
        <p className="text-sm text-gray-500">No event scheduled yet.</p>
        <p className="text-xs text-gray-400 text-center max-w-xs">
          The run sheet will appear here once the MC adds an event for this couple.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 pb-16">

        {/* Logo */}
        <div className="pt-10 pb-2">
          <Image src="/zebri-logo.svg" alt="Zebri" width={64} height={23} />
        </div>

        <VendorTimeline
          events={vendorData.events}
          items={vendorData.timeline_items}
        />

      </div>
    </div>
  )
}

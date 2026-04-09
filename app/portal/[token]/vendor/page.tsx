import Image from 'next/image'
import { createServerClient } from '@supabase/ssr'
import { Clock } from 'lucide-react'

interface VendorTimelineItem {
  id: string
  start_time: string | null
  title: string
  description: string | null
  duration_min: number | null
  position: number
  pending_review: boolean
}

interface VendorData {
  event: { date: string; venue: string } | null
  timeline_items: VendorTimelineItem[]
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

function formatTime(time: string | null): string {
  if (!time) return 'No time'
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
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

  if (!vendorData || !vendorData.event) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 gap-6">
        <Image src="/zebri-logo.svg" alt="Zebri" width={80} height={29} />
        <p className="text-sm text-gray-500">This link is not active.</p>
      </div>
    )
  }

  const { event, timeline_items } = vendorData

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 pb-16">

        {/* Logo */}
        <div className="pt-10 pb-2">
          <Image src="/zebri-logo.svg" alt="Zebri" width={64} height={23} />
        </div>

        {/* Header */}
        <div className="pt-8 pb-8 border-b border-gray-100">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Run Sheet</h1>
          <p className="text-sm text-gray-500">
            {formatEventDate(event.date)}
            {event.venue ? ` · ${event.venue}` : ''}
          </p>
        </div>

        {/* Timeline */}
        <div className="pt-8 space-y-2">
          {timeline_items.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No items yet.</p>
          ) : (
            timeline_items.map((item) => (
              <div
                key={item.id}
                className={`flex items-start gap-4 border rounded-xl px-4 py-3 ${
                  item.pending_review
                    ? 'border-amber-100 bg-amber-50/30'
                    : 'border-gray-100 bg-white'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs w-20 shrink-0 pt-0.5">
                  <Clock size={11} strokeWidth={1.5} className="text-gray-300" />
                  <span className={item.start_time ? 'text-gray-600 font-medium tabular-nums' : 'text-gray-300'}>
                    {formatTime(item.start_time)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
                  {item.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                  )}
                  {item.duration_min && (
                    <p className="text-xs text-gray-400 mt-0.5">{item.duration_min} min</p>
                  )}
                </div>
                {item.pending_review && (
                  <span className="text-xs bg-amber-50 text-amber-500 border border-amber-100 rounded-full px-2 py-0.5 shrink-0">
                    Provisional
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer note */}
        <div className="border-t border-gray-100 mt-12 pt-6">
          <p className="text-xs text-gray-400">
            Items marked "Provisional" are awaiting MC confirmation. This run sheet may be updated — check back for the latest version.
          </p>
        </div>

      </div>
    </div>
  )
}

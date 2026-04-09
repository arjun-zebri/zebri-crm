'use client'

import { Check } from 'lucide-react'

interface PortalTimelineItem {
  id: string
  event_id: string
  start_time: string | null
  title: string
  description: string | null
  duration_min: number | null
  position: number
  pending_review: boolean
}

function formatTime(time: string | null): string {
  if (!time) return 'No time'
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

interface McPortalRunsheetProps {
  items: PortalTimelineItem[]
  onApprove: (itemId: string) => void
  isApproving: boolean
}

export function McPortalRunsheet({ items, onApprove, isApproving }: McPortalRunsheetProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
        <p className="text-sm text-gray-500">No pending suggestions</p>
        <p className="text-sm text-gray-400">
          Couple suggestions from the portal will appear here for your review.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <p className="text-sm text-gray-500 mb-4">
        {items.length} suggestion{items.length !== 1 ? 's' : ''} from the couple waiting for your review.
      </p>
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-4 border border-amber-200 bg-amber-50/40 rounded-xl px-5 py-4"
        >
          <div className="text-sm text-gray-600 w-20 shrink-0 pt-0.5 tabular-nums font-medium">
            {formatTime(item.start_time)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-medium text-gray-900">{item.title}</p>
            {item.description && (
              <p className="text-sm text-gray-500 mt-0.5">{item.description}</p>
            )}
          </div>
          <button
            onClick={() => onApprove(item.id)}
            disabled={isApproving}
            className="flex items-center gap-1.5 text-sm text-emerald-600 border border-emerald-200 bg-emerald-50 rounded-lg px-3 py-2 hover:bg-emerald-100 transition cursor-pointer disabled:opacity-50 shrink-0"
          >
            <Check size={14} strokeWidth={2} />
            Approve
          </button>
        </div>
      ))}
    </div>
  )
}

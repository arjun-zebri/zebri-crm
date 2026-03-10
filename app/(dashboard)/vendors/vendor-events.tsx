'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

interface VendorEventsProps {
  vendorId: string
}

interface EventVendor {
  id: string
  events: Array<{
    id: string
    date: string
    venue: string
    couples: Array<{
      name: string
    }> | null
  }> | null
}

export function VendorEvents({ vendorId }: VendorEventsProps) {
  const supabase = createClient()

  const { data: eventVendors, isLoading } = useQuery({
    queryKey: ['vendor-events', vendorId],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('event_vendors')
        .select(
          `
          id,
          events(id, date, venue, couples(name))
        `
        )
        .eq('vendor_id', vendorId)
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data as EventVendor[]) || []
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (!eventVendors || eventVendors.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-500">
          No events linked yet. Events will appear here once this vendor is assigned to a wedding.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {eventVendors.map((ev) => {
        const events = ev.events
        if (!events || events.length === 0) return null
        const event = events[0]
        const coupleName = event.couples?.[0]?.name
        return (
          <div
            key={ev.id}
            className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <div>
              <div className="text-sm font-medium text-gray-900">{coupleName}</div>
              <div className="text-xs text-gray-500">{event.venue}</div>
            </div>
            <div className="text-sm text-gray-600">{formatDate(event.date)}</div>
          </div>
        )
      })}
    </div>
  )
}

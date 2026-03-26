'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft } from 'lucide-react'
import { EventDayCalendar } from '../../event-day-calendar'
import { formatDate } from '@/lib/utils'

export default function EventTimelinePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const { data: event, isLoading } = useQuery({
    queryKey: ['event-header', params.id],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('events')
        .select('id, date, venue, couple:couple_id(name)')
        .eq('id', params.id)
        .eq('user_id', user.user.id)
        .single()

      if (error) throw error
      return data as unknown as { id: string; date: string; venue: string; couple: { name: string } }
    },
  })

  return (
    <div className="max-w-2xl mx-auto px-6 sm:px-8 py-8">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition cursor-pointer mb-6"
      >
        <ArrowLeft size={16} strokeWidth={1.5} />
        Back
      </button>

      {/* Header */}
      <div className="mb-8">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
          </div>
        ) : event ? (
          <>
            <h1 className="text-3xl font-semibold text-gray-900">
              {event.couple?.name ?? 'Timeline'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {event.date ? formatDate(event.date) : ''}
              {event.date && event.venue ? ' · ' : ''}
              {event.venue}
            </p>
          </>
        ) : null}
      </div>

      {/* Day calendar */}
      <EventDayCalendar eventId={params.id} />
    </div>
  )
}

'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Event } from './events/events-types'
import { Couple } from './couples/couples-types'

export function useUpcomingWeddings() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['upcomingWeddings'],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      // Get today's date and 30 days from now
      const today = new Date()
      const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
      const todayStr = today.toISOString().split('T')[0]
      const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('events')
        .select('*, couple:couples(id, name)')
        .eq('user_id', user.user.id)
        .eq('status', 'upcoming')
        .gte('date', todayStr)
        .lte('date', thirtyDaysStr)
        .order('date', { ascending: true })

      if (error) throw error
      return (data as Event[]) || []
    },
  })
}

export function useRecentCouples() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['recentCouples'],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('couples')
        .select('*')
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      return (data as Couple[]) || []
    },
  })
}

export function useUpcomingWeddingsWithDefault() {
  const query = useUpcomingWeddings()
  return { ...query, data: query.data || [] }
}

export function useRecentCouplesWithDefault() {
  const query = useRecentCouples()
  return { ...query, data: query.data || [] }
}

export function useDashboardStats() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      // Get current and previous month boundaries
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split('T')[0]
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString()
        .split('T')[0]

      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        .toISOString()
        .split('T')[0]
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
        .toISOString()
        .split('T')[0]

      // Fetch total couples
      const { count: totalCouples, error: couplesError } = await supabase
        .from('couples')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)

      if (couplesError) throw couplesError

      // Fetch couples from last month
      const { count: couplesLastMonth, error: couplesLastMonthError } = await supabase
        .from('couples')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .gte('created_at', `${prevMonthStart}T00:00:00`)
        .lte('created_at', `${prevMonthEnd}T23:59:59`)

      if (couplesLastMonthError) throw couplesLastMonthError

      // Fetch active vendors
      const { count: activeVendors, error: vendorsError } = await supabase
        .from('vendors')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .eq('status', 'active')

      if (vendorsError) throw vendorsError

      // Fetch weddings this month
      const { count: weddingsThisMonth, error: eventsError } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .gte('date', monthStart)
        .lte('date', monthEnd)

      if (eventsError) throw eventsError

      // Fetch weddings last month
      const { count: weddingsLastMonth, error: eventsLastMonthError } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .gte('date', prevMonthStart)
        .lte('date', prevMonthEnd)

      if (eventsLastMonthError) throw eventsLastMonthError

      const coupleCouplesCurrent = totalCouples || 0
      const coupleCouplesLast = couplesLastMonth || 0
      const couplesChange = coupleCouplesCurrent - coupleCouplesLast
      const couplesPercent = coupleCouplesLast > 0 ? Math.round((couplesChange / coupleCouplesLast) * 100) : 0

      const weddingsCurrent = weddingsThisMonth || 0
      const weddingsLast = weddingsLastMonth || 0
      const weddingsChange = weddingsCurrent - weddingsLast
      const weddingsPercent = weddingsLast > 0 ? Math.round((weddingsChange / weddingsLast) * 100) : 0

      return {
        totalCouples: coupleCouplesCurrent,
        couplesChange,
        couplesPercent,
        activeVendors: activeVendors || 0,
        weddingsThisMonth: weddingsCurrent,
        weddingsChange,
        weddingsPercent,
      }
    },
  })
}

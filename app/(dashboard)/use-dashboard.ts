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
        .select('*, couple:couples(id, name, status)')
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

function groupByDay(records: { created_at: string }[], daysBack = 7): number[] {
  const bins = Array(daysBack).fill(0)
  const now = Date.now()
  records.forEach((r) => {
    const msAgo = now - new Date(r.created_at).getTime()
    const daysAgo = Math.floor(msAgo / 86400000)
    if (daysAgo >= 0 && daysAgo < daysBack) {
      bins[daysBack - 1 - daysAgo]++
    }
  })
  return bins
}

export function useDashboardStats() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const today = new Date()
      const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
      const fourteenDaysBefore = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)

      const todayStr = today.toISOString().split('T')[0]
      const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0]
      const fourteenStr = fourteenDaysBefore.toISOString().split('T')[0]

      // Current month boundaries
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      const monthStartStr = monthStart.toISOString().split('T')[0]

      // Previous month boundaries
      const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
      const prevMonthStartStr = prevMonthStart.toISOString().split('T')[0]
      const prevMonthEndStr = prevMonthEnd.toISOString().split('T')[0]

      // New enquiries (couples with status = 'new')
      const { count: newEnquiries } = await supabase
        .from('couples')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .eq('status', 'new')

      // Couples created this month vs last month (for sparkline & change)
      const { data: couplesThisMonth } = await supabase
        .from('couples')
        .select('created_at')
        .eq('user_id', user.user.id)
        .gte('created_at', monthStartStr)

      const { count: couplesLastMonth } = await supabase
        .from('couples')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .gte('created_at', prevMonthStartStr)
        .lte('created_at', prevMonthEndStr)

      // Couples last 14 days for sparkline
      const { data: couplesRecent } = await supabase
        .from('couples')
        .select('created_at')
        .eq('user_id', user.user.id)
        .gte('created_at', fourteenStr)

      // Open tasks (status != 'done')
      const { count: openTasks } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .neq('status', 'done')

      // Tasks created recently for sparkline
      const { data: tasksRecent } = await supabase
        .from('tasks')
        .select('created_at')
        .eq('user_id', user.user.id)
        .gte('created_at', fourteenStr)

      // Tasks due this week
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      const nextWeekStr = nextWeek.toISOString().split('T')[0]
      const { count: dueThisWeek } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .neq('status', 'done')
        .gte('due_date', todayStr)
        .lte('due_date', nextWeekStr)

      // Tasks due last month same week window (for comparison)
      const lastMonthToday = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate())
      const lastMonthNextWeek = new Date(lastMonthToday.getTime() + 7 * 24 * 60 * 60 * 1000)
      const { count: dueLastMonth } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .neq('status', 'done')
        .gte('due_date', lastMonthToday.toISOString().split('T')[0])
        .lte('due_date', lastMonthNextWeek.toISOString().split('T')[0])

      // Upcoming weddings (next 30 days)
      const { count: upcomingWeddings } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .gte('date', todayStr)
        .lte('date', thirtyDaysStr)

      // Upcoming weddings from last month's equivalent window
      const lastMonthTodayStr = lastMonthToday.toISOString().split('T')[0]
      const lastMonthThirtyDays = new Date(lastMonthToday.getTime() + 30 * 24 * 60 * 60 * 1000)
      const lastMonthThirtyDaysStr = lastMonthThirtyDays.toISOString().split('T')[0]
      const { count: upcomingLastMonth } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .gte('date', lastMonthTodayStr)
        .lte('date', lastMonthThirtyDaysStr)

      // Completed weddings this month
      const { data: completedThisMonthData } = await supabase
        .from('events')
        .select('created_at')
        .eq('user_id', user.user.id)
        .eq('status', 'completed')
        .gte('created_at', monthStartStr)

      // Completed weddings last month
      const { count: completedLastMonth } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .eq('status', 'completed')
        .gte('created_at', prevMonthStartStr)
        .lte('created_at', prevMonthEndStr)

      // Active vendors
      const { count: vendorCount } = await supabase
        .from('vendors')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .eq('status', 'active')

      // Vendors added this month vs last month
      const { count: vendorsThisMonth } = await supabase
        .from('vendors')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .gte('created_at', monthStartStr)

      const { count: vendorsLastMonth } = await supabase
        .from('vendors')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .gte('created_at', prevMonthStartStr)
        .lte('created_at', prevMonthEndStr)

      // Sparklines
      const newEnquiriesSparkline = groupByDay(couplesRecent || [])
      const openTasksSparkline = groupByDay(tasksRecent || [])
      const upcomingSparkline = groupByDay(couplesRecent || [])
      const completedSparkline = groupByDay(completedThisMonthData || [])
      const vendorSparkline = Array(7).fill(vendorCount !== null ? Math.ceil((vendorCount || 0) / 7) : 0)
      const dueThisWeekSparkline = groupByDay(tasksRecent || [])

      // Calculate month-over-month changes
      const calcChange = (current: number | null, previous: number | null): number | null => {
        const curr = current || 0
        const prev = previous || 0
        if (prev === 0) return null
        return Math.round(((curr - prev) / prev) * 100)
      }

      const thisMonthCouplesCount = couplesThisMonth?.length || 0
      const newEnquiriesChange = calcChange(thisMonthCouplesCount, couplesLastMonth)
      const completedThisMonth = completedThisMonthData?.length || 0
      const completedChange = calcChange(completedThisMonth, completedLastMonth)
      const openTasksChange = calcChange(dueThisWeek, dueLastMonth)
      const upcomingChange = calcChange(upcomingWeddings, upcomingLastMonth)
      const vendorChange = calcChange(vendorsThisMonth, vendorsLastMonth)
      const dueThisWeekChange = openTasksChange

      return {
        newEnquiries: newEnquiries || 0,
        newEnquiriesChange,
        newEnquiriesSparkline,
        openTasks: openTasks || 0,
        openTasksChange,
        openTasksSparkline,
        upcomingWeddings: upcomingWeddings || 0,
        upcomingChange,
        upcomingSparkline,
        completedWeddings: completedThisMonth,
        completedChange,
        completedSparkline,
        vendorCount: vendorCount || 0,
        vendorChange,
        vendorSparkline,
        dueThisWeek: dueThisWeek || 0,
        dueThisWeekChange,
        dueThisWeekSparkline,
      }
    },
  })
}

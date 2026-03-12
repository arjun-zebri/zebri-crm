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

function daysBetween(record: { created_at: string }): number {
  const now = Date.now()
  const msAgo = now - new Date(record.created_at).getTime()
  return Math.floor(msAgo / 86400000)
}

function getDayOfMonth(dateStr: string): number {
  return new Date(dateStr).getDate()
}

function isCurrentMonth(dateStr: string): boolean {
  const now = new Date()
  const date = new Date(dateStr)
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
}

function isLastYearSameMonth(dateStr: string): boolean {
  const now = new Date()
  const date = new Date(dateStr)
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() - 1
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
      const thirtyDaysBefore = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      const fourteenDaysBefore = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)

      const todayStr = today.toISOString().split('T')[0]
      const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0]
      const fourteenStr = fourteenDaysBefore.toISOString().split('T')[0]
      const thirtyBeforeStr = thirtyDaysBefore.toISOString().split('T')[0]

      // New enquiries (couples with status = 'new')
      const { count: newEnquiries, error: newEnquiriesError } = await supabase
        .from('couples')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .eq('status', 'new')

      if (newEnquiriesError) throw newEnquiriesError

      // Fetch couples created in last 14 days for sparkline
      const { data: couplesData, error: couplesError } = await supabase
        .from('couples')
        .select('created_at')
        .eq('user_id', user.user.id)
        .gte('created_at', fourteenStr)

      if (couplesError) throw couplesError

      // Open tasks (status != 'done')
      const { count: openTasks, error: openTasksError } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .neq('status', 'done')

      if (openTasksError) throw openTasksError

      // Fetch tasks created in last 14 days for sparkline
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('created_at')
        .eq('user_id', user.user.id)
        .gte('created_at', fourteenStr)

      if (tasksError) throw tasksError

      // Upcoming weddings (next 30 days)
      const { count: upcomingWeddings, error: upcomingWeddingsError } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .gte('date', todayStr)
        .lte('date', thirtyDaysStr)

      if (upcomingWeddingsError) throw upcomingWeddingsError

      // Fetch completed weddings (this month)
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      const monthStartStr = monthStart.toISOString().split('T')[0]
      const { data: completedWeddingsData, error: completedError } = await supabase
        .from('events')
        .select('created_at')
        .eq('user_id', user.user.id)
        .eq('status', 'completed')
        .gte('created_at', monthStartStr)

      if (completedError) throw completedError

      // Fetch completed weddings (same month last year)
      const lastYearMonthStart = new Date(today.getFullYear() - 1, today.getMonth(), 1)
      const lastYearMonthEnd = new Date(today.getFullYear() - 1, today.getMonth() + 1, 0)
      const lastYearMonthStartStr = lastYearMonthStart.toISOString().split('T')[0]
      const lastYearMonthEndStr = lastYearMonthEnd.toISOString().split('T')[0]
      const { count: completedLastYear, error: completedLastYearError } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .eq('status', 'completed')
        .gte('created_at', lastYearMonthStartStr)
        .lte('created_at', lastYearMonthEndStr)

      if (completedLastYearError) throw completedLastYearError

      // Fetch vendors (active)
      const { count: vendorCount, error: vendorError } = await supabase
        .from('vendors')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .eq('status', 'active')

      if (vendorError) throw vendorError

      // Fetch tasks due this week
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      const nextWeekStr = nextWeek.toISOString().split('T')[0]
      const { count: dueThisWeek, error: dueThisWeekError } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .neq('status', 'done')
        .gte('due_date', todayStr)
        .lte('due_date', nextWeekStr)

      if (dueThisWeekError) throw dueThisWeekError

      // Fetch all couples for new enquiries this month
      const { data: allCouplesData, error: allCouplesError } = await supabase
        .from('couples')
        .select('created_at')
        .eq('user_id', user.user.id)

      if (allCouplesError) throw allCouplesError

      // Fetch open tasks from last year same period for comparison
      const lastYearToday = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000)
      const lastYearNextWeek = new Date(lastYearToday.getTime() + 7 * 24 * 60 * 60 * 1000)
      const lastYearTodayStr = lastYearToday.toISOString().split('T')[0]
      const lastYearNextWeekStr = lastYearNextWeek.toISOString().split('T')[0]
      const { count: openTasksLastYear, error: openTasksLastYearError } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .neq('status', 'done')
        .gte('due_date', lastYearTodayStr)
        .lte('due_date', lastYearNextWeekStr)

      if (openTasksLastYearError) throw openTasksLastYearError

      // Fetch upcoming weddings from last year
      const lastYearTodayStr2 = lastYearToday.toISOString().split('T')[0]
      const lastYearThirtyDaysStr = new Date(lastYearToday.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const { count: upcomingWeddingsLastYear, error: upcomingLastYearError } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .gte('date', lastYearTodayStr2)
        .lte('date', lastYearThirtyDaysStr)

      if (upcomingLastYearError) throw upcomingLastYearError

      // Fetch active vendors from last year
      const { count: vendorCountLastYear, error: vendorCountLastYearError } = await supabase
        .from('vendors')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .eq('status', 'active')

      if (vendorCountLastYearError) throw vendorCountLastYearError

      // Calculate sparklines
      const newEnquiriesSparkline = groupByDay(couplesData || [])
      const openTasksSparkline = groupByDay(tasksData || [])
      const upcomingSparkline = groupByDay(couplesData || [])
      const completedSparkline = groupByDay(completedWeddingsData || [])

      // For vendors and tasks, use steady sparklines (all same value)
      const vendorSparkline = Array(7).fill(vendorCount !== null ? Math.ceil((vendorCount || 0) / 7) : 0)
      const dueThisWeekSparkline = Array(7).fill(dueThisWeek !== null ? Math.ceil((dueThisWeek || 0) / 7) : 0)

      // Calculate year-over-year comparisons
      const thisMonthCouples = (allCouplesData || []).filter((r) => isCurrentMonth(r.created_at)).length
      const lastYearCouples = (allCouplesData || []).filter((r) => isLastYearSameMonth(r.created_at)).length
      const newEnquiriesChange =
        lastYearCouples > 0
          ? Math.round(((thisMonthCouples - lastYearCouples) / lastYearCouples) * 100)
          : null

      const completedThisMonth = completedWeddingsData?.length || 0
      const completedChange =
        (completedLastYear || 0) > 0
          ? Math.round(((completedThisMonth - (completedLastYear || 0)) / (completedLastYear || 0)) * 100)
          : null

      const openTasksChange =
        (openTasksLastYear || 0) > 0
          ? Math.round(((dueThisWeek - (openTasksLastYear || 0)) / (openTasksLastYear || 0)) * 100)
          : null

      const upcomingChange =
        (upcomingWeddingsLastYear || 0) > 0
          ? Math.round(((upcomingWeddings - (upcomingWeddingsLastYear || 0)) / (upcomingWeddingsLastYear || 0)) * 100)
          : null

      const vendorChange =
        (vendorCountLastYear || 0) > 0
          ? Math.round(((vendorCount - (vendorCountLastYear || 0)) / (vendorCountLastYear || 0)) * 100)
          : null

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

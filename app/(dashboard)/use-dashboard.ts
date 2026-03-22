"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Event } from "./events/events-types";
import {
  CoupleStatus,
  STATUSES,
  LeadSource,
  LEAD_SOURCES,
} from "./couples/couples-types";

export function useDashboardStats() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboardStats"],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");

      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const thisMonthStartStr = thisMonthStart.toISOString().split("T")[0];
      const lastMonthStartStr = lastMonthStart.toISOString().split("T")[0];

      // Total leads (all couples)
      const { count: totalLeads } = await supabase
        .from("couples")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.user.id);

      // Leads added this month
      const { count: leadsThisMonth } = await supabase
        .from("couples")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.user.id)
        .gte("created_at", thisMonthStartStr);

      // Leads added last month
      const { count: leadsLastMonth } = await supabase
        .from("couples")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.user.id)
        .gte("created_at", lastMonthStartStr)
        .lt("created_at", thisMonthStartStr);

      const leadsDiff = (leadsThisMonth || 0) - (leadsLastMonth || 0);

      // Conversion rate: confirmed+paid+complete / leads added this month
      const { count: convertedThisMonth } = await supabase
        .from("couples")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.user.id)
        .in("status", ["confirmed", "paid", "complete"])
        .gte("created_at", thisMonthStartStr);

      const conversionRate =
        leadsThisMonth && leadsThisMonth > 0
          ? Math.round(((convertedThisMonth || 0) / leadsThisMonth) * 100)
          : 0;

      // Previous month conversion rate (leads added last month)
      const { count: convertedLastMonth } = await supabase
        .from("couples")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.user.id)
        .in("status", ["confirmed", "paid", "complete"])
        .gte("created_at", lastMonthStartStr)
        .lt("created_at", thisMonthStartStr);

      const prevConversionRate =
        leadsLastMonth && leadsLastMonth > 0
          ? Math.round(((convertedLastMonth || 0) / leadsLastMonth) * 100)
          : 0;

      // Percentage change in conversion rate
      const conversionDiff = prevConversionRate > 0
        ? Math.round(((conversionRate - prevConversionRate) / prevConversionRate) * 100)
        : conversionRate > 0 ? 100 : 0;

      // Total revenue: SUM(price) where status='completed' (all time)
      const { data: totalRevenueData } = await supabase
        .from("events")
        .select("price")
        .eq("user_id", user.user.id)
        .eq("status", "completed")
        .not("price", "is", null);

      const totalRevenue = (totalRevenueData || []).reduce(
        (sum, e) => sum + (Number(e.price) || 0),
        0
      );

      // Revenue from events completed this month
      const { data: revenueThisMonthData } = await supabase
        .from("events")
        .select("price")
        .eq("user_id", user.user.id)
        .eq("status", "completed")
        .gte("date", thisMonthStartStr)
        .not("price", "is", null);

      const revenueThisMonth = (revenueThisMonthData || []).reduce(
        (sum, e) => sum + (Number(e.price) || 0),
        0
      );

      // Revenue from events completed last month
      const { data: revenueLastMonthData } = await supabase
        .from("events")
        .select("price")
        .eq("user_id", user.user.id)
        .eq("status", "completed")
        .gte("date", lastMonthStartStr)
        .lt("date", thisMonthStartStr)
        .not("price", "is", null);

      const revenueLastMonth = (revenueLastMonthData || []).reduce(
        (sum, e) => sum + (Number(e.price) || 0),
        0
      );

      const revenueDiff = revenueThisMonth - revenueLastMonth;

      // Percentage changes
      const leadsPercentChange =
        (leadsLastMonth || 0) > 0
          ? Math.round(
              (((leadsThisMonth || 0) - (leadsLastMonth || 0)) /
                (leadsLastMonth || 1)) *
                100
            )
          : (leadsThisMonth || 0) > 0
          ? 100
          : 0;

      const revenuePercentChange =
        revenueLastMonth > 0
          ? Math.round(
              ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
            )
          : revenueThisMonth > 0
          ? 100
          : 0;

      return {
        totalLeads: totalLeads || 0,
        leadsPercentChange,
        leadsDiff,
        conversionRate,
        conversionDiff,
        totalRevenue,
        revenuePercentChange,
        revenueDiff,
      };
    },
  });
}

export type ChartPeriod = "1m" | "3m" | "6m" | "1Y";

function getPeriodMonths(period: ChartPeriod): number {
  switch (period) {
    case "1m":
      return 1;
    case "3m":
      return 3;
    case "6m":
      return 6;
    case "1Y":
      return 12;
  }
}

export function useRevenueChart(period: ChartPeriod) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["revenueChart", period],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");

      const months = getPeriodMonths(period);
      const now = new Date();
      const startDate = new Date(
        now.getFullYear(),
        now.getMonth() - months + 1,
        1
      );
      const startStr = startDate.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("events")
        .select("date, price")
        .eq("user_id", user.user.id)
        .eq("status", "completed")
        .gte("date", startStr)
        .not("price", "is", null);

      if (error) throw error;

      // Group by month
      const monthMap = new Map<string, number>();

      // Initialize all months in range
      for (let i = 0; i < months; i++) {
        const d = new Date(
          startDate.getFullYear(),
          startDate.getMonth() + i,
          1
        );
        const key = d.toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        });
        monthMap.set(key, 0);
      }

      // Sum prices per month
      for (const event of data || []) {
        const d = new Date(event.date);
        const key = d.toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        });
        monthMap.set(
          key,
          (monthMap.get(key) || 0) + (Number(event.price) || 0)
        );
      }

      const chartData = Array.from(monthMap.entries()).map(
        ([month, revenue]) => ({
          month,
          revenue,
        })
      );

      const total = chartData.reduce((sum, d) => sum + d.revenue, 0);

      // Calculate % change vs previous period
      const prevStartDate = new Date(
        startDate.getFullYear(),
        startDate.getMonth() - months,
        1
      );
      const prevStartStr = prevStartDate.toISOString().split("T")[0];
      const prevEndStr = startDate.toISOString().split("T")[0];

      const { data: prevData } = await supabase
        .from("events")
        .select("price")
        .eq("user_id", user.user.id)
        .eq("status", "completed")
        .gte("date", prevStartStr)
        .lt("date", prevEndStr)
        .not("price", "is", null);

      const prevTotal = (prevData || []).reduce(
        (sum, e) => sum + (Number(e.price) || 0),
        0
      );

      const percentChange =
        prevTotal > 0
          ? Math.round(((total - prevTotal) / prevTotal) * 100)
          : total > 0
          ? 100
          : 0;

      return { chartData, total, percentChange };
    },
  });
}

export function useLeadsChart(period: ChartPeriod) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["leadsChart", period],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");

      const months = getPeriodMonths(period);
      const now = new Date();
      const startDate = new Date(
        now.getFullYear(),
        now.getMonth() - months + 1,
        1
      );
      const startStr = startDate.toISOString();

      const { data, error } = await supabase
        .from("couples")
        .select("created_at")
        .eq("user_id", user.user.id)
        .gte("created_at", startStr);

      if (error) throw error;

      // Group by month
      const monthMap = new Map<string, number>();
      for (let i = 0; i < months; i++) {
        const d = new Date(
          startDate.getFullYear(),
          startDate.getMonth() + i,
          1
        );
        const key = d.toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        });
        monthMap.set(key, 0);
      }

      for (const couple of data || []) {
        const d = new Date(couple.created_at);
        const key = d.toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        });
        monthMap.set(key, (monthMap.get(key) || 0) + 1);
      }

      const chartData = Array.from(monthMap.entries()).map(
        ([month, leads]) => ({
          month,
          leads,
        })
      );

      const total = chartData.reduce((sum, d) => sum + d.leads, 0);

      // Previous period
      const prevStartDate = new Date(
        startDate.getFullYear(),
        startDate.getMonth() - months,
        1
      );
      const prevStartStr = prevStartDate.toISOString();

      const { count: prevTotal } = await supabase
        .from("couples")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.user.id)
        .gte("created_at", prevStartStr)
        .lt("created_at", startStr);

      const percentChange =
        (prevTotal || 0) > 0
          ? Math.round(((total - (prevTotal || 0)) / (prevTotal || 1)) * 100)
          : total > 0
          ? 100
          : 0;

      return { chartData, total, percentChange };
    },
  });
}

export function useCalendarEvents(year: number, month: number) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["calendarEvents", year, month],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");

      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      const startStr = startDate.toISOString().split("T")[0];
      const endStr = endDate.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("events")
        .select("*, couple:couples(id, name, status)")
        .eq("user_id", user.user.id)
        .gte("date", startStr)
        .lte("date", endStr)
        .order("date", { ascending: true });

      if (error) throw error;
      return (data as Event[]) || [];
    },
  });
}

export function useLeadsManagement() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["leadsManagement"],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneWeekAgoStr = oneWeekAgo.toISOString();

      const counts: Record<CoupleStatus, number> = {
        new: 0,
        contacted: 0,
        confirmed: 0,
        paid: 0,
        complete: 0,
      };

      const prevCounts: Record<CoupleStatus, number> = {
        new: 0,
        contacted: 0,
        confirmed: 0,
        paid: 0,
        complete: 0,
      };

      for (const status of STATUSES) {
        const { count } = await supabase
          .from("couples")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.user.id)
          .eq("status", status);

        counts[status] = count || 0;

        // Count for prior week (couples that existed before one week ago)
        const { count: prevCount } = await supabase
          .from("couples")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.user.id)
          .eq("status", status)
          .lt("created_at", oneWeekAgoStr);

        prevCounts[status] = prevCount || 0;
      }

      const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
      const prevTotal = Object.values(prevCounts).reduce(
        (sum, c) => sum + c,
        0
      );

      return { counts, prevCounts, total, prevTotal };
    },
  });
}

export function useLeadSources() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["leadSources"],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneWeekAgoStr = oneWeekAgo.toISOString();

      const counts: Record<string, number> = {};
      const prevCounts: Record<string, number> = {};

      for (const source of LEAD_SOURCES) {
        const { count } = await supabase
          .from("couples")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.user.id)
          .eq("lead_source", source);

        counts[source] = count || 0;

        const { count: prevCount } = await supabase
          .from("couples")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.user.id)
          .eq("lead_source", source)
          .lt("created_at", oneWeekAgoStr);

        prevCounts[source] = prevCount || 0;
      }

      // Count couples with no lead source
      const { count: noSource } = await supabase
        .from("couples")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.user.id)
        .is("lead_source", null);

      counts["unknown"] = noSource || 0;

      const { count: prevNoSource } = await supabase
        .from("couples")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.user.id)
        .is("lead_source", null)
        .lt("created_at", oneWeekAgoStr);

      prevCounts["unknown"] = prevNoSource || 0;

      const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
      const prevTotal = Object.values(prevCounts).reduce(
        (sum, c) => sum + c,
        0
      );

      return { counts, prevCounts, total, prevTotal };
    },
  });
}

interface DashboardTask {
  id: string;
  title: string;
  due_date: string | null;
  status: "todo" | "in_progress" | "done";
  related_couple_id: string | null;
  couple?: { id: string; name: string } | null;
}

export function useDashboardTasks() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboardTasks"],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("tasks")
        .select(
          "id, title, due_date, status, related_couple_id, couple:couples(id, name)"
        )
        .eq("user_id", user.user.id)
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(10);

      if (error) throw error;
      // Supabase returns joined relations as arrays; normalize to single object
      const normalized = (data || []).map((t: any) => ({
        ...t,
        couple: Array.isArray(t.couple) ? t.couple[0] || null : t.couple,
      }));
      return normalized as DashboardTask[];
    },
  });
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Event } from "./events/events-types";
import {
  LeadSource,
  LEAD_SOURCES,
} from "./couples/couples-types";
import { CoupleStatusRecord } from "./couples/couples-types";

export type DashboardPeriod = "week" | "month" | "quarter" | "year";

// Rolling window for stat cards — avoids start-of-period cliff drops
function getRollingWindow(period: DashboardPeriod) {
  const now = new Date();
  const daysMap: Record<DashboardPeriod, number> = { week: 7, month: 30, quarter: 90, year: 365 };
  const ms = daysMap[period] * 24 * 60 * 60 * 1000;
  const currentStart = new Date(now.getTime() - ms).toISOString();
  const previousStart = new Date(now.getTime() - 2 * ms).toISOString();
  return { currentStart, previousStart, previousEnd: currentStart };
}

// Calendar-aligned window for charts — anchors to real week/month/quarter/year boundaries
function getPeriodWindow(period: DashboardPeriod) {
  const now = new Date();

  switch (period) {
    case "week": {
      const dayOfWeek = now.getDay();
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const currentStart = new Date(now);
      currentStart.setDate(now.getDate() - daysFromMonday);
      currentStart.setHours(0, 0, 0, 0);
      const previousStart = new Date(currentStart);
      previousStart.setDate(previousStart.getDate() - 7);
      return {
        currentStart: currentStart.toISOString(),
        previousStart: previousStart.toISOString(),
        previousEnd: currentStart.toISOString(),
      };
    }
    case "month": {
      const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const daysElapsed = now.getDate() - 1;
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      const previousEnd = new Date(prevMonthStart);
      previousEnd.setDate(previousEnd.getDate() + daysElapsed + 1);
      return {
        currentStart: currentStart.toISOString(),
        previousStart: prevMonthStart.toISOString(),
        previousEnd: (previousEnd > prevMonthEnd ? prevMonthEnd : previousEnd).toISOString(),
      };
    }
    case "quarter": {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const currentStart = new Date(now.getFullYear(), qMonth, 1);
      const daysElapsed = Math.floor((now.getTime() - currentStart.getTime()) / 86400000);
      const prevQStart = new Date(now.getFullYear(), qMonth - 3, 1);
      const previousEnd = new Date(prevQStart);
      previousEnd.setDate(previousEnd.getDate() + daysElapsed + 1);
      return {
        currentStart: currentStart.toISOString(),
        previousStart: prevQStart.toISOString(),
        previousEnd: previousEnd.toISOString(),
      };
    }
    case "year": {
      const currentStart = new Date(now.getFullYear(), 0, 1);
      const daysElapsed = Math.floor((now.getTime() - currentStart.getTime()) / 86400000);
      const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);
      const previousEnd = new Date(prevYearStart);
      previousEnd.setDate(previousEnd.getDate() + daysElapsed + 1);
      return {
        currentStart: currentStart.toISOString(),
        previousStart: prevYearStart.toISOString(),
        previousEnd: previousEnd.toISOString(),
      };
    }
  }
}

export function useDashboardStats(period: DashboardPeriod = "month") {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboardStats", period],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");

      const { currentStart, previousStart, previousEnd } = getRollingWindow(period);

      // Leads added in current period
      const { count: leadsThisPeriod } = await supabase
        .from("couples")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.user.id)
        .gte("created_at", currentStart);

      // Leads added in previous period
      const { count: leadsLastPeriod } = await supabase
        .from("couples")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.user.id)
        .gte("created_at", previousStart)
        .lt("created_at", previousEnd);

      const leadsDiff = (leadsThisPeriod || 0) - (leadsLastPeriod || 0);

      // Conversion: of leads added this period, how many have a converted status NOW
      const { count: convertedThisPeriod } = await supabase
        .from("couples")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.user.id)
        .in("status", ["confirmed", "paid", "complete"])
        .gte("created_at", currentStart);

      const { count: convertedLastPeriod } = await supabase
        .from("couples")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.user.id)
        .in("status", ["confirmed", "paid", "complete"])
        .gte("created_at", previousStart)
        .lt("created_at", previousEnd);

      const conversionRate =
        (leadsThisPeriod || 0) > 0
          ? Math.round(((convertedThisPeriod || 0) / (leadsThisPeriod || 1)) * 100)
          : 0;

      const prevConversionRate =
        (leadsLastPeriod || 0) > 0
          ? Math.round(((convertedLastPeriod || 0) / (leadsLastPeriod || 1)) * 100)
          : 0;

      const conversionDiff = conversionRate - prevConversionRate;

      // Revenue collected (paid_at) in current period
      const { data: revenueThisData } = await supabase
        .from("invoices")
        .select("subtotal")
        .eq("user_id", user.user.id)
        .eq("status", "paid")
        .gte("paid_at", currentStart)
        .not("paid_at", "is", null);

      const revenueThisPeriod = (revenueThisData || []).reduce(
        (s, i) => s + (Number(i.subtotal) || 0),
        0
      );

      const { data: revenueLastData } = await supabase
        .from("invoices")
        .select("subtotal")
        .eq("user_id", user.user.id)
        .eq("status", "paid")
        .gte("paid_at", previousStart)
        .lt("paid_at", previousEnd)
        .not("paid_at", "is", null);

      const revenueLastPeriod = (revenueLastData || []).reduce(
        (s, i) => s + (Number(i.subtotal) || 0),
        0
      );

      // % changes — handle zero-previous gracefully
      const leadsPercentChange =
        (leadsLastPeriod || 0) > 0
          ? Math.round(
              (((leadsThisPeriod || 0) - (leadsLastPeriod || 0)) /
                (leadsLastPeriod || 1)) *
                100
            )
          : (leadsThisPeriod || 0) > 0
          ? 100
          : 0;

      const revenueDiff = revenueThisPeriod - revenueLastPeriod;
      const revenuePercentChange =
        revenueLastPeriod > 0
          ? Math.round(((revenueDiff / revenueLastPeriod) * 100))
          : revenueThisPeriod > 0
          ? 100
          : 0;

      // Also fetch total all-time collected + invoiced for the collected card subtitle
      const { data: collectedData } = await supabase
        .from("invoices")
        .select("subtotal")
        .eq("user_id", user.user.id)
        .eq("status", "paid");
      const collectedRevenue = (collectedData || []).reduce(
        (s, i) => s + (Number(i.subtotal) || 0),
        0
      );

      const { data: invoicedData } = await supabase
        .from("invoices")
        .select("subtotal")
        .eq("user_id", user.user.id)
        .in("status", ["sent", "overdue"]);
      const invoicedRevenue = (invoicedData || []).reduce(
        (s, i) => s + (Number(i.subtotal) || 0),
        0
      );

      return {
        totalLeads: leadsThisPeriod || 0,
        leadsPercentChange,
        leadsDiff,
        conversionRate,
        conversionDiff,
        totalRevenue: revenueThisPeriod,
        revenuePercentChange,
        revenueDiff,
        collectedRevenue: revenueThisPeriod,
        invoicedRevenue,
      };
    },
  });
}

// Returns chart config for trend views:
// Weekly  → last 7 days (day by day)
// Monthly → last 12 months (month by month)
// Quarterly → last 6 quarters (quarter by quarter)
// Yearly  → last 5 years (year by year)
function getChartConfig(period: DashboardPeriod): {
  chartStart: Date;
  format: (d: Date) => string;
  initKeys: () => string[];
} {
  const now = new Date();

  switch (period) {
    case "week": {
      // Last 8 weeks, week by week (Monday-anchored)
      const dayOfWeek = now.getDay();
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const currentMonday = new Date(now);
      currentMonday.setDate(now.getDate() - daysFromMonday);
      currentMonday.setHours(0, 0, 0, 0);
      const chartStart = new Date(currentMonday);
      chartStart.setDate(chartStart.getDate() - 7 * 7);
      const getMonday = (d: Date) => {
        const day = d.getDay();
        const mon = new Date(d);
        mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        mon.setHours(0, 0, 0, 0);
        return mon;
      };
      const fmt = (d: Date) =>
        getMonday(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return {
        chartStart,
        format: fmt,
        initKeys: () =>
          Array.from({ length: 8 }, (_, i) => {
            const d = new Date(chartStart);
            d.setDate(d.getDate() + i * 7);
            return fmt(d);
          }),
      };
    }
    case "month": {
      const chartStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const fmt = (d: Date) =>
        new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        });
      return {
        chartStart,
        format: fmt,
        initKeys: () =>
          Array.from({ length: 12 }, (_, i) =>
            fmt(new Date(chartStart.getFullYear(), chartStart.getMonth() + i, 1))
          ),
      };
    }
    case "quarter": {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const chartStart = new Date(now.getFullYear(), qMonth - 15, 1);
      const fmtQ = (d: Date) => {
        const q = Math.floor(d.getMonth() / 3) + 1;
        return `Q${q} '${String(d.getFullYear()).slice(2)}`;
      };
      return {
        chartStart,
        format: (d) =>
          fmtQ(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)),
        initKeys: () =>
          Array.from({ length: 6 }, (_, i) =>
            fmtQ(
              new Date(chartStart.getFullYear(), chartStart.getMonth() + i * 3, 1)
            )
          ),
      };
    }
    case "year": {
      const chartStart = new Date(now.getFullYear() - 4, 0, 1);
      return {
        chartStart,
        format: (d) => String(d.getFullYear()),
        initKeys: () =>
          Array.from({ length: 5 }, (_, i) =>
            String(chartStart.getFullYear() + i)
          ),
      };
    }
  }
}

export function useRevenueChart(period: DashboardPeriod = "month") {
  const supabase = createClient();

  return useQuery({
    queryKey: ["revenueChart", period],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");

      const { chartStart, format, initKeys } = getChartConfig(period);

      const { data, error } = await supabase
        .from("invoices")
        .select("paid_at, subtotal")
        .eq("user_id", user.user.id)
        .eq("status", "paid")
        .gte("paid_at", chartStart.toISOString())
        .not("paid_at", "is", null);

      if (error) throw error;

      const groupMap = new Map<string, number>();
      for (const key of initKeys()) groupMap.set(key, 0);
      for (const invoice of data || []) {
        const key = format(new Date(invoice.paid_at!));
        if (groupMap.has(key))
          groupMap.set(key, (groupMap.get(key) || 0) + (Number(invoice.subtotal) || 0));
      }

      const chartData = Array.from(groupMap.entries()).map(([label, revenue]) => ({
        label,
        revenue,
      }));

      // Header stat uses rolling window so it never cliff-drops at period start
      const { currentStart, previousStart, previousEnd } = getRollingWindow(period);

      const { data: curData } = await supabase
        .from("invoices")
        .select("subtotal")
        .eq("user_id", user.user.id)
        .eq("status", "paid")
        .gte("paid_at", currentStart)
        .not("paid_at", "is", null);
      const total = (curData || []).reduce((s, i) => s + (Number(i.subtotal) || 0), 0);

      const { data: prevData } = await supabase
        .from("invoices")
        .select("subtotal")
        .eq("user_id", user.user.id)
        .eq("status", "paid")
        .gte("paid_at", previousStart)
        .lt("paid_at", previousEnd)
        .not("paid_at", "is", null);
      const prevTotal = (prevData || []).reduce((s, i) => s + (Number(i.subtotal) || 0), 0);

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

export function useLeadsChart(period: DashboardPeriod = "month") {
  const supabase = createClient();

  return useQuery({
    queryKey: ["leadsChart", period],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");

      const { chartStart, format, initKeys } = getChartConfig(period);

      const { data, error } = await supabase
        .from("couples")
        .select("created_at")
        .eq("user_id", user.user.id)
        .gte("created_at", chartStart.toISOString());

      if (error) throw error;

      const groupMap = new Map<string, number>();
      for (const key of initKeys()) groupMap.set(key, 0);
      for (const couple of data || []) {
        const key = format(new Date(couple.created_at));
        if (groupMap.has(key)) groupMap.set(key, (groupMap.get(key) || 0) + 1);
      }

      const chartData = Array.from(groupMap.entries()).map(([label, leads]) => ({
        label,
        leads,
      }));

      // Header stat uses rolling window
      const { currentStart, previousStart, previousEnd } = getRollingWindow(period);

      const { count: curTotal } = await supabase
        .from("couples")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.user.id)
        .gte("created_at", currentStart);

      const { count: prevTotal } = await supabase
        .from("couples")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.user.id)
        .gte("created_at", previousStart)
        .lt("created_at", previousEnd);

      const total = curTotal || 0;
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

export function useLeadsManagement(period: DashboardPeriod = "month") {
  const supabase = createClient();

  return useQuery({
    queryKey: ["leadsManagement", period],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");

      const { currentStart } = getPeriodWindow(period);

      // Fetch user's statuses
      const { data: statusesData, error: statusesError } = await supabase
        .from("couple_statuses")
        .select("*")
        .eq("user_id", user.user.id)
        .order("position", { ascending: true });

      if (statusesError) throw statusesError;
      const statuses = (statusesData as CoupleStatusRecord[]) || [];

      const counts: Record<string, number> = {};
      const prevCounts: Record<string, number> = {};

      for (const status of statuses) {
        const { count } = await supabase
          .from("couples")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.user.id)
          .eq("status", status.slug);

        counts[status.slug] = count || 0;

        // Count for prior period (couples that existed before current period)
        const { count: prevCount } = await supabase
          .from("couples")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.user.id)
          .eq("status", status.slug)
          .lt("created_at", currentStart);

        prevCounts[status.slug] = prevCount || 0;
      }

      const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
      const prevTotal = Object.values(prevCounts).reduce(
        (sum, c) => sum + c,
        0
      );

      return { statuses, counts, prevCounts, total, prevTotal };
    },
  });
}

export function useLeadSources(period: DashboardPeriod = "month") {
  const supabase = createClient();

  return useQuery({
    queryKey: ["leadSources", period],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");

      const { currentStart } = getPeriodWindow(period);

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
          .lt("created_at", currentStart);

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
        .lt("created_at", currentStart);

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

export interface DashboardInvoice {
  id: string;
  invoice_number: string;
  title: string;
  subtotal: number;
  due_date: string | null;
  status: string;
  couple: { id: string; name: string } | null;
}

export function useDashboardInvoices() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboardInvoices"],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, title, subtotal, due_date, status, couple:couple_id(id, name)")
        .eq("user_id", user.user.id)
        .in("status", ["sent", "overdue"])
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(10);

      if (error) throw error;
      const normalized = (data || []).map((i: any) => ({
        ...i,
        couple: Array.isArray(i.couple) ? i.couple[0] || null : i.couple,
      }));
      return normalized as DashboardInvoice[];
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

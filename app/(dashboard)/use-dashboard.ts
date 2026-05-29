"use client";

import { useQuery } from "@tanstack/react-query";

import {
  getChartConfig,
  getPeriodWindow,
  getRollingWindow,
  type DashboardPeriod,
} from '@/lib/dashboard/periods';
import { createClient } from "@/lib/supabase/client";
import { LEAD_SOURCES } from '@/types/couple';
import { CoupleStatusRecord } from '@/types/couple';
import { Event } from '@/types/event';


export type { DashboardPeriod };

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

      // % changes - handle zero-previous gracefully
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

      // Fetch outstanding (invoiced but not yet paid) for the
      // collected card subtitle. The "collectedRevenue" field on
      // the return shape currently uses `revenueThisPeriod` rather
      // than an all-time total (matches the current UI's per-period
      // framing). We removed an unused all-time query that was
      // computed but never returned.
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
      // Supabase returns joined `couple` as an array OR a single
      // object depending on the foreign-key cardinality. Normalise.
      type CoupleRel = { id: string; name: string };
      type InvoiceRow = Omit<DashboardInvoice, 'couple'> & {
        couple: CoupleRel | CoupleRel[] | null;
      };
      const normalized = (data ?? []).map((i) => {
        const row = i as unknown as InvoiceRow;
        const couple = Array.isArray(row.couple)
          ? row.couple[0] ?? null
          : row.couple;
        return { ...row, couple } as DashboardInvoice;
      });
      return normalized;
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
      // Supabase returns joined relations as arrays; normalize to
      // a single object (or null).
      type CoupleRel = { id: string; name: string };
      type TaskRow = Omit<DashboardTask, 'couple'> & {
        couple: CoupleRel | CoupleRel[] | null;
      };
      const normalized = (data ?? []).map((t) => {
        const row = t as unknown as TaskRow;
        const couple = Array.isArray(row.couple)
          ? row.couple[0] ?? null
          : row.couple;
        return { ...row, couple } as DashboardTask;
      });
      return normalized;
    },
  });
}

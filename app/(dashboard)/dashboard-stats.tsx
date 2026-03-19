"use client";

import { Loader2, TrendingUp, TrendingDown } from "lucide-react";

interface DashboardStatsProps {
  newEnquiries: number;
  newEnquiriesChange: number | null;
  newEnquiriesSparkline: number[];
  openTasks: number;
  openTasksChange: number | null;
  openTasksSparkline: number[];
  upcomingWeddings: number;
  upcomingChange: number | null;
  upcomingSparkline: number[];
  completedWeddings: number;
  completedChange: number | null;
  completedSparkline: number[];
  vendorCount: number;
  vendorChange: number | null;
  vendorSparkline: number[];
  dueThisWeek: number;
  dueThisWeekChange: number | null;
  dueThisWeekSparkline: number[];
  isLoading: boolean;
}

interface StatCard {
  label: string;
  description: string;
  value: number;
  change: number | null;
  sparkline: number[];
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const max = Math.max(...data, 1);
  const W = 100;
  const H = 32;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - (v / max) * H,
  ]);
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0">
      <path
        d={d}
        fill="none"
        stroke={positive ? "#10b981" : "#ef4444"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DashboardStats({
  newEnquiries,
  newEnquiriesChange,
  newEnquiriesSparkline,
  openTasks,
  openTasksChange,
  openTasksSparkline,
  upcomingWeddings,
  upcomingChange,
  upcomingSparkline,
  completedWeddings,
  completedChange,
  completedSparkline,
  vendorCount,
  vendorChange,
  vendorSparkline,
  dueThisWeek,
  dueThisWeekChange,
  dueThisWeekSparkline,
  isLoading,
}: DashboardStatsProps) {
  const renderCard = ({
    label,
    description,
    value,
    change,
    sparkline,
  }: StatCard) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="mb-4">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</div>
        <div className="text-xs text-gray-400 mt-0.5">{description}</div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-3xl font-semibold text-gray-900">
                {value}
              </div>
              {change !== null && (
                <div
                  className={`flex items-center gap-0.5 mt-1 text-xs font-medium ${
                    change >= 0 ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {change >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {change >= 0 ? "+" : ""}
                  {change}% vs last month
                </div>
              )}
            </div>
            <Sparkline
              data={sparkline}
              positive={change === null || change >= 0}
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-3 gap-4">
      {renderCard({
        label: "New Enquiries",
        description: "Couples added this month",
        value: newEnquiries,
        change: newEnquiriesChange,
        sparkline: newEnquiriesSparkline,
      })}
      {renderCard({
        label: "Open Tasks",
        description: "Actions awaiting completion",
        value: openTasks,
        change: openTasksChange,
        sparkline: openTasksSparkline,
      })}
      {renderCard({
        label: "Upcoming Weddings",
        description: "Scheduled in the next 30 days",
        value: upcomingWeddings,
        change: upcomingChange,
        sparkline: upcomingSparkline,
      })}
      {renderCard({
        label: "Completed",
        description: "Weddings delivered this month",
        value: completedWeddings,
        change: completedChange,
        sparkline: completedSparkline,
      })}
      {renderCard({
        label: "Active Vendors",
        description: "Partners in your network",
        value: vendorCount,
        change: vendorChange,
        sparkline: vendorSparkline,
      })}
      {renderCard({
        label: "Due This Week",
        description: "Tasks needing your attention",
        value: dueThisWeek,
        change: dueThisWeekChange,
        sparkline: dueThisWeekSparkline,
      })}
    </div>
  );
}

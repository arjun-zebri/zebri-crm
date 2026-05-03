"use client";

import { useState, useRef, useEffect } from "react";
import { useDashboardStats, useDashboardTasks, DashboardPeriod } from "./use-dashboard";
import { DashboardStats } from "./dashboard-stats";
import { DashboardRevenueChart } from "./dashboard-revenue-chart";
import { DashboardCalendar } from "./dashboard-calendar";
import { DashboardLeads } from "./dashboard-leads";
import { DashboardLeadSources } from "./dashboard-lead-sources";
import { DashboardTasks } from "./dashboard-tasks";
import { DashboardInvoices } from "./dashboard-invoices";
import { CoupleProfile } from "./couples/couple-profile";
import { Couple } from "./couples/couples-types";
import { ChevronDown } from "lucide-react";

const periodOptions: { value: DashboardPeriod; label: string }[] = [
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "quarter", label: "Quarterly" },
  { value: "year", label: "Yearly" },
];

export default function DashboardPage() {
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const [periodOpen, setPeriodOpen] = useState(false);
  const periodRef = useRef<HTMLDivElement>(null);
  const { data: stats, isLoading: statsLoading } = useDashboardStats(period);
  const { data: tasks, isLoading: tasksLoading } = useDashboardTasks();
  const [selectedCouple, setSelectedCouple] = useState<Couple | null>(null);
  const [defaultTab, setDefaultTab] = useState<'overview' | 'tasks' | 'payments'>('overview');

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (periodRef.current && !periodRef.current.contains(e.target as Node)) {
        setPeriodOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleEventClick = (coupleData: { id: string; name: string }) => {
    setDefaultTab('overview');
    setSelectedCouple({
      id: coupleData.id,
      name: coupleData.name,
      user_id: "",
      email: "",
      phone: "",
      event_date: null,
      venue: "",
      notes: "",
      status: "new",
      lead_source: null,
      kanban_position: 0,
      created_at: new Date().toISOString(),
    });
  };

  const handleTaskCoupleClick = (coupleData: { id: string; name: string }) => {
    setDefaultTab('tasks');
    setSelectedCouple({
      id: coupleData.id,
      name: coupleData.name,
      user_id: "",
      email: "",
      phone: "",
      event_date: null,
      venue: "",
      notes: "",
      status: "new",
      lead_source: null,
      kanban_position: 0,
      created_at: new Date().toISOString(),
    });
  };

  const handleInvoiceCoupleClick = (coupleData: { id: string; name: string }) => {
    setDefaultTab('payments');
    setSelectedCouple({
      id: coupleData.id,
      name: coupleData.name,
      user_id: "",
      email: "",
      phone: "",
      event_date: null,
      venue: "",
      notes: "",
      status: "new",
      lead_source: null,
      kanban_position: 0,
      created_at: new Date().toISOString(),
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 md:px-6 pt-4 md:pt-6 pb-4 md:pb-6 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">Dashboard</h1>
          <div className="relative" ref={periodRef}>
            <button
              onClick={() => setPeriodOpen(!periodOpen)}
              className="flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
            >
              {periodOptions.find((o) => o.value === period)?.label}
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.5} />
            </button>
            {periodOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[110px]">
                {periodOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setPeriod(opt.value); setPeriodOpen(false); }}
                    className={`block w-full text-left px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition first:rounded-t-lg last:rounded-b-lg ${
                      period === opt.value ? "font-medium text-gray-900" : "text-gray-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hover">
        <div className="px-4 md:px-6 pb-4 md:pb-6 space-y-6">
          {/* Top section: Stats + Revenue (left) | Calendar (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 lg:h-[560px]">
            <div className="lg:col-span-5 flex flex-col gap-6 lg:h-full">
              <DashboardStats
                totalLeads={stats?.totalLeads || 0}
                leadsPercentChange={stats?.leadsPercentChange || 0}
                leadsDiff={stats?.leadsDiff || 0}
                conversionRate={stats?.conversionRate || 0}
                conversionDiff={stats?.conversionDiff || 0}
                totalRevenue={stats?.totalRevenue || 0}
                revenuePercentChange={stats?.revenuePercentChange || 0}
                revenueDiff={stats?.revenueDiff || 0}
                collectedRevenue={stats?.collectedRevenue}
                invoicedRevenue={stats?.invoicedRevenue}
                isLoading={statsLoading}
                period={period}
              />
              <div className="flex-1 min-h-0">
                <DashboardRevenueChart period={period} />
              </div>
            </div>
            <div className="lg:col-span-2 lg:h-full">
              <DashboardCalendar onEventClick={handleEventClick} />
            </div>
          </div>

          {/* Bottom section: Leads | Lead Sources | Outstanding Tasks | Outstanding Invoices */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <DashboardLeads period={period} />
            <DashboardLeadSources period={period} />
            <DashboardTasks
              tasks={tasks || []}
              isLoading={tasksLoading}
              onCoupleClick={handleTaskCoupleClick}
            />
            <DashboardInvoices onCoupleClick={handleInvoiceCoupleClick} />
          </div>
        </div>
      </div>

      {/* Profile slide-over */}
      <CoupleProfile
        couple={selectedCouple}
        onClose={() => setSelectedCouple(null)}
        onSave={() => {}}
        onDelete={() => {}}
        loading={false}
        defaultTab={defaultTab}
      />
    </div>
  );
}

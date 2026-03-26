"use client";

import { useState } from "react";
import { useDashboardStats, useDashboardTasks } from "./use-dashboard";
import { DashboardStats } from "./dashboard-stats";
import { DashboardRevenueChart } from "./dashboard-revenue-chart";
import { DashboardCalendar } from "./dashboard-calendar";
import { DashboardLeads } from "./dashboard-leads";
import { DashboardLeadSources } from "./dashboard-lead-sources";
import { DashboardTasks } from "./dashboard-tasks";
import { CoupleProfile } from "./couples/couple-profile";
import { Couple } from "./couples/couples-types";

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: tasks, isLoading: tasksLoading } = useDashboardTasks();
  const [selectedCouple, setSelectedCouple] = useState<Couple | null>(null);
  const [defaultTab, setDefaultTab] = useState<'overview' | 'events' | 'vendors' | 'tasks'>('overview');

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
      created_at: new Date().toISOString(),
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 md:px-6 pt-4 md:pt-6 pb-4 md:pb-6 flex-shrink-0">
        <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
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
                isLoading={statsLoading}
              />
              <div className="flex-1 min-h-0">
                <DashboardRevenueChart />
              </div>
            </div>
            <div className="lg:col-span-2 lg:h-full h-[420px]">
              <DashboardCalendar onEventClick={handleEventClick} />
            </div>
          </div>

          {/* Bottom section: Leads | Lead Sources | Outstanding Tasks */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <DashboardLeads />
            <DashboardLeadSources />
            <DashboardTasks
              tasks={tasks || []}
              isLoading={tasksLoading}
              onCoupleClick={handleTaskCoupleClick}
            />
          </div>
        </div>
      </div>

      {/* Profile slide-over */}
      <CoupleProfile
        couple={selectedCouple}
        onClose={() => setSelectedCouple(null)}
        onEdit={() => {}}
        defaultTab={defaultTab}
      />
    </div>
  );
}

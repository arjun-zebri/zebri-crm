'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import type {
  AdminDashboard,
  AdminUser,
} from '@/lib/admin/admin-analytics';
import type { UserStats } from '@/lib/admin/user-value';

import { UserDetailPanel } from './components/user-detail-panel';
import { ConnectIssuesList } from './sections/connect-issues-list';
import { DormantList } from './sections/dormant-list';
import { EngagementSection } from './sections/engagement-section';
import { MetricCards } from './sections/metric-cards';
import { PastDueList } from './sections/past-due-list';
import { RecentSignupsList } from './sections/recent-signups-list';
import { UpcomingRenewalsList } from './sections/upcoming-renewals-list';
import { UsersTableView } from './sections/users-table-view';

type TabId = 'dashboard' | 'users';

const tabs: { id: TabId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'users', label: 'Users' },
];

/**
 * Admin orchestrator with two views: a founder dashboard (hero
 * metric charts + operational action lists) and a flat Users table
 * with its own search bar.
 *
 * The detail-panel state is hoisted here so opening a user from
 * either tab uses the same slide-over.
 */
export function AdminDashboardView({
  users,
  dashboard,
  stats,
}: {
  users: AdminUser[];
  dashboard: AdminDashboard;
  stats: Record<string, UserStats>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab: TabId =
    searchParams.get('tab') === 'users' ? 'users' : 'dashboard';
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const openUser = users.find((u) => u.id === openUserId) ?? null;

  const handleTabChange = (tabId: TabId) => {
    router.replace(`/admin?tab=${tabId}`);
  };

  return (
    <>
      <div className="px-4 md:px-6 flex-shrink-0">
        <div className="relative overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] border-b border-border">
          <div className="flex gap-6 mb-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={`pb-3 text-body whitespace-nowrap transition-colors relative cursor-pointer ${
                  activeTab === tab.id
                    ? 'text-text font-medium'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-text" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hover">
        <div className="px-4 md:px-6 pt-6 pb-6">
          {activeTab === 'dashboard' ? (
            <DashboardView dashboard={dashboard} onOpenUser={setOpenUserId} />
          ) : (
            <UsersTableView users={users} stats={stats} onOpenUser={setOpenUserId} />
          )}
        </div>
      </div>

      <UserDetailPanel
        user={openUser}
        onClose={() => setOpenUserId(null)}
        onRefresh={() => router.refresh()}
      />
    </>
  );
}

function DashboardView({
  dashboard,
  onOpenUser,
}: {
  dashboard: AdminDashboard;
  onOpenUser: (userId: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Row 1 — 4 hero chart cards (MRR / active / churn / signups) */}
      <MetricCards dashboard={dashboard} />

      {/* Row 2 — engagement: who's actually using the product, and
          which paying accounts have gone quiet */}
      <EngagementSection
        engagement={dashboard.engagement}
        goneQuiet={dashboard.goneQuietUsers}
        onOpenUser={onOpenUser}
      />

      {/* Row 3 — operational action lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <UpcomingRenewalsList
          renewals={dashboard.renewals}
          onOpenUser={onOpenUser}
        />
        <PastDueList rows={dashboard.pastDueUsers} onOpenUser={onOpenUser} />
        <ConnectIssuesList
          rows={dashboard.connectIssues}
          onOpenUser={onOpenUser}
        />
      </div>

      {/* Row 4 — supporting lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DormantList rows={dashboard.dormantUsers} onOpenUser={onOpenUser} />
        <RecentSignupsList
          rows={dashboard.recentSignups}
          onOpenUser={onOpenUser}
        />
      </div>
    </div>
  );
}

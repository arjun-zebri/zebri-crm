"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AdminUser, GlobalStats } from '@/lib/admin/admin-analytics';
import type { OpsSnapshot } from '@/lib/admin/ops-signals';
import { UsersTab } from "./tabs/users-tab";
import { SubscriptionsTab } from "./tabs/subscriptions-tab";
import { OpsTab } from "./tabs/ops-tab";
import { StatsTab } from "./tabs/stats-tab";
import { UserDetailPanel } from "./components/user-detail-panel";
import { UserSearchBar } from "./components/user-search-bar";

const tabs = [
  { id: "users", label: "Users" },
  { id: "subscriptions", label: "Subscriptions" },
  { id: "ops", label: "Ops" },
  { id: "stats", label: "Stats" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function AdminTabs({
  users,
  stats,
  ops,
}: {
  users: AdminUser[];
  stats: GlobalStats;
  ops: OpsSnapshot;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = (searchParams.get("tab") as TabId) || "users";
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  const handleTabChange = (tabId: TabId) => {
    router.replace(`/admin?tab=${tabId}`);
  };

  const openUser = users.find((u) => u.id === openUserId) ?? null;

  return (
    <>
      <div className="px-4 md:px-6 pb-4 flex-shrink-0">
        <UserSearchBar users={users} onSelect={setOpenUserId} />
      </div>

      <div className="px-4 md:px-6 flex-shrink-0">
        <div className="relative overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] border-b border-border">
          <div className="flex gap-6 mb-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                aria-current={activeTab === tab.id ? "page" : undefined}
                className={`pb-3 text-sm whitespace-nowrap transition-colors relative cursor-pointer ${
                  activeTab === tab.id
                    ? "text-text font-medium"
                    : "text-text-muted hover:text-text"
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

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 md:px-6 pt-6 pb-6">
          {activeTab === "users" && (
            <UsersTab users={users} onOpenUser={setOpenUserId} />
          )}
          {activeTab === "subscriptions" && (
            <SubscriptionsTab users={users} onOpenUser={setOpenUserId} />
          )}
          {activeTab === "ops" && (
            <OpsTab snapshot={ops} onOpenUser={setOpenUserId} />
          )}
          {activeTab === "stats" && <StatsTab stats={stats} />}
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

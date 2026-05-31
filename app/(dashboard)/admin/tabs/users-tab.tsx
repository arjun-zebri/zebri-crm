"use client";

import { Badge } from "@/components/ui/badge";
import type { AdminUser, SubscriptionStatus } from '@/lib/admin/admin-analytics';

const statusVariant: Record<SubscriptionStatus, "paid" | "contacted" | "cancelled" | "default"> = {
  active: "paid",
  trialing: "contacted",
  past_due: "cancelled",
  cancelled: "default",
  expired: "default",
};

function formatDate(iso: string | null) {
  if (!iso) return " - ";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function planLabel(user: AdminUser) {
  if (user.subscription_status === "active" && user.subscription_plan) {
    return user.subscription_plan === "pro" ? "Pro" : "Max";
  }
  return "Starter";
}

export function UsersTab({
  users,
  onOpenUser,
}: {
  users: AdminUser[];
  onOpenUser: (userId: string) => void;
}) {
  return (
    <div>
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted border-b border-border">
              <tr>
                <Th>Name</Th>
                <Th>Business</Th>
                <Th>Email</Th>
                <Th>Status</Th>
                <Th>Plan</Th>
                <Th>Trial ends</Th>
                <Th>Signed up</Th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-subtle">
                    No users yet
                  </td>
                </tr>
              )}
              {users.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => onOpenUser(user.id)}
                  className="border-b border-border last:border-0 hover:bg-surface-emphasis cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-text">
                    {user.display_name || " - "}
                    {user.account_type === "admin" && (
                      <span className="ml-2 text-xs bg-surface-emphasis text-text-muted px-1.5 py-0.5 rounded">
                        admin
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{user.business_name || " - "}</td>
                  <td className="px-4 py-3 text-text-muted">{user.email}</td>
                  <td className="px-4 py-3">
                    {user.subscription_status ? (
                      <Badge variant={statusVariant[user.subscription_status]}>
                        {user.subscription_status.replace("_", " ")}
                      </Badge>
                    ) : (
                      <span className="text-text-subtle text-xs"> - </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{planLabel(user)}</td>
                  <td className="px-4 py-3 text-text-muted">{formatDate(user.trial_end)}</td>
                  <td className="px-4 py-3 text-text-muted">{formatDate(user.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-text-subtle">{users.length} users</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-3 font-medium text-text-muted whitespace-nowrap">
      {children}
    </th>
  );
}

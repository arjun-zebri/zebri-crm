"use client";

import { Badge } from "@/components/ui/badge";
import type { AdminUser, SubscriptionStatus } from "@/lib/admin-analytics";

const statusVariant: Record<SubscriptionStatus, "paid" | "contacted" | "cancelled" | "default"> = {
  active: "paid",
  trialing: "contacted",
  past_due: "cancelled",
  cancelled: "default",
  expired: "default",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
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
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
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
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No users yet
                  </td>
                </tr>
              )}
              {users.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => onOpenUser(user.id)}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium">
                    {user.display_name || "—"}
                    {user.account_type === "admin" && (
                      <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                        admin
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{user.business_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{user.email}</td>
                  <td className="px-4 py-3">
                    {user.subscription_status ? (
                      <Badge variant={statusVariant[user.subscription_status]}>
                        {user.subscription_status.replace("_", " ")}
                      </Badge>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{planLabel(user)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(user.trial_end)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(user.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-gray-400">{users.length} users</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
      {children}
    </th>
  );
}

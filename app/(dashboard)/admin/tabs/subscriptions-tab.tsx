"use client";

import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AdminUser, SubscriptionStatus } from "@/lib/admin-analytics";

const PLAN_PRICE: Record<string, number> = { pro: 49, max: 89 };

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

function mrrFor(user: AdminUser) {
  if (user.subscription_status !== "active" || !user.subscription_plan) return 0;
  // Comped and beta users don't pay the standard plan price.
  if (user.is_comped || user.is_beta_user || !user.stripe_subscription_id) return 0;
  return PLAN_PRICE[user.subscription_plan] ?? 0;
}

export function SubscriptionsTab({
  users,
  onOpenUser,
}: {
  users: AdminUser[];
  onOpenUser: (userId: string) => void;
}) {
  const subscribers = useMemo(() => {
    return users
      .filter(
        (u) =>
          u.stripe_customer_id ||
          (u.subscription_status &&
            ["trialing", "active", "past_due", "cancelled"].includes(
              u.subscription_status
            ))
      )
      .sort((a, b) => mrrFor(b) - mrrFor(a));
  }, [users]);

  const totalMrr = useMemo(
    () => subscribers.reduce((sum, u) => sum + mrrFor(u), 0),
    [subscribers]
  );

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <div className="text-xs text-gray-500">
          Active MRR <span className="font-medium text-gray-900">${totalMrr.toFixed(0)}</span>
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <Th>User</Th>
                <Th>Email</Th>
                <Th>Status</Th>
                <Th>Plan</Th>
                <Th>Trial end</Th>
                <Th>Sub end</Th>
                <Th>Customer</Th>
                <Th>MRR</Th>
              </tr>
            </thead>
            <tbody>
              {subscribers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No subscriptions yet
                  </td>
                </tr>
              )}
              {subscribers.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => onOpenUser(user.id)}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium">{user.display_name || " - "}</td>
                  <td className="px-4 py-3 text-gray-600">{user.email}</td>
                  <td className="px-4 py-3">
                    {user.subscription_status ? (
                      <Badge variant={statusVariant[user.subscription_status]}>
                        {user.subscription_status.replace("_", " ")}
                      </Badge>
                    ) : (
                      <span className="text-gray-400 text-xs"> - </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">
                    {user.subscription_plan ?? " - "}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(user.trial_end)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDate(user.subscription_end)}
                  </td>
                  <td className="px-4 py-3">
                    {user.stripe_customer_id ? (
                      <a
                        href={`https://dashboard.stripe.com/customers/${user.stripe_customer_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
                      >
                        {user.stripe_customer_id.slice(0, 14)}…
                        <ExternalLink size={12} strokeWidth={1.5} />
                      </a>
                    ) : (
                      <span className="text-gray-400 text-xs"> - </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {mrrFor(user) > 0 ? `$${mrrFor(user)}` : " - "}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-gray-400">{subscribers.length} subscriptions</p>
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

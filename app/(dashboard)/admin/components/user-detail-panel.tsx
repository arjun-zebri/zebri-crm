"use client";

import { useEffect, useState, useTransition } from "react";
import { ExternalLink, UserCog } from "lucide-react";
import { SidePanel } from "@/components/ui/side-panel";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import type { AdminUser, SubscriptionStatus, UserAnalytics } from "@/lib/admin-analytics";
import {
  enterShadow,
  extendTrial,
  compUser,
  cancelAtPeriodEnd,
  refundLastInvoice,
  updateUserProfile,
  sendPasswordReset,
  deleteUser,
  fetchUserAnalytics,
  linkStripeCustomer,
} from "@/app/admin/actions";

const statusVariant: Record<SubscriptionStatus, "paid" | "contacted" | "cancelled" | "default"> = {
  active: "paid",
  trialing: "contacted",
  past_due: "cancelled",
  cancelled: "default",
  expired: "default",
};

function formatDateTime(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-US");
}

function formatDate(iso: string | null) {
  if (!iso) return " - ";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toDateInput(iso: string | null): string {
  if (!iso) {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  }
  return new Date(iso).toISOString().slice(0, 10);
}

export function UserDetailPanel({
  user,
  onClose,
  onRefresh,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  return (
    <SidePanel
      isOpen={!!user}
      onClose={onClose}
      title={user ? user.email : undefined}
    >
      {user && <PanelBody key={user.id} user={user} onRefresh={onRefresh} onClose={onClose} />}
    </SidePanel>
  );
}

function PanelBody({
  user,
  onRefresh,
  onClose,
}: {
  user: AdminUser;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const [displayName, setDisplayName] = useState(user.display_name);
  const [businessName, setBusinessName] = useState(user.business_name);
  const [profileSaving, setProfileSaving] = useState(false);

  const [trialEnd, setTrialEnd] = useState(toDateInput(user.trial_end));
  const [refundAmount, setRefundAmount] = useState("");
  const [compPlan, setCompPlan] = useState<"pro" | "max">(
    (user.subscription_plan as "pro" | "max") ?? "pro"
  );
  const [linkCustomerId, setLinkCustomerId] = useState("");

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setAnalyticsLoading(true);
    fetchUserAnalytics(user.id)
      .then((d) => {
        if (!cancelled) setAnalytics(d);
      })
      .catch(() => {
        if (!cancelled) toast("Failed to load analytics", "error");
      })
      .finally(() => {
        if (!cancelled) setAnalyticsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user.id, toast]);

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      await updateUserProfile(user.id, {
        display_name: displayName,
        business_name: businessName,
      });
      toast("Profile updated");
      onRefresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to update profile", "error");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleExtendTrial = async () => {
    try {
      const iso = new Date(trialEnd + "T00:00:00").toISOString();
      await extendTrial(user.id, iso);
      toast("Trial extended");
      onRefresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to extend trial", "error");
    }
  };

  const handleComp = async () => {
    try {
      await compUser(user.id, compPlan);
      toast(`Comped on ${compPlan.toUpperCase()}`);
      onRefresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to comp user", "error");
    }
  };

  const handleCancel = async () => {
    setConfirmCancel(false);
    try {
      await cancelAtPeriodEnd(user.id);
      toast("Subscription will cancel at period end");
      onRefresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to cancel", "error");
    }
  };

  const handleRefund = async () => {
    const dollars = parseFloat(refundAmount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      toast("Enter a valid amount", "error");
      return;
    }
    try {
      const result = await refundLastInvoice(user.id, Math.round(dollars * 100));
      toast(`Refund ${result.status ?? "submitted"}`);
      setRefundAmount("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to refund", "error");
    }
  };

  const handlePasswordReset = async () => {
    try {
      const { recoveryLink } = await sendPasswordReset(user.id);
      if (recoveryLink) {
        await navigator.clipboard.writeText(recoveryLink).catch(() => {});
        toast("Recovery link copied to clipboard");
      } else {
        toast("Recovery email sent");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to send reset", "error");
    }
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    try {
      await deleteUser(user.id);
      toast("User deleted");
      onClose();
      onRefresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete user", "error");
    }
  };

  const handleLinkStripe = async () => {
    if (!linkCustomerId.trim()) {
      toast("Paste the Stripe customer ID", "error");
      return;
    }
    try {
      const result = await linkStripeCustomer(user.id, linkCustomerId);
      toast(
        result.subscriptionId
          ? `Linked: ${result.plan ?? "?"} (${result.status ?? "?"})`
          : "Customer linked, no subscription found",
      );
      setLinkCustomerId("");
      onRefresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to link Stripe customer", "error");
    }
  };

  const handleEnterShadow = () => {
    startTransition(async () => {
      try {
        await enterShadow(user.id);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed to enter shadow mode", "error");
      }
    });
  };

  return (
    <div className="space-y-6">
      <Section title="Profile">
        <div className="space-y-3">
          <Field label="Display name">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </Field>
          <Field label="Business name">
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </Field>
          <button
            onClick={handleSaveProfile}
            disabled={profileSaving}
            className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 cursor-pointer"
          >
            {profileSaving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </Section>

      <Section title="Activity">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Couples" value={analyticsLoading ? "…" : analytics?.couples ?? 0} />
          <Stat label="Events" value={analyticsLoading ? "…" : analytics?.events ?? 0} />
          <Stat label="Invoices" value={analyticsLoading ? "…" : analytics?.invoices ?? 0} />
          <Stat label="Contracts" value={analyticsLoading ? "…" : analytics?.contracts ?? 0} />
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Last sign-in:{" "}
          {analyticsLoading ? "…" : formatDateTime(analytics?.lastSignInAt ?? null)}
        </p>
      </Section>

      <Section title="Subscription">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Detail label="Status">
            {user.subscription_status ? (
              <Badge variant={statusVariant[user.subscription_status]}>
                {user.subscription_status.replace("_", " ")}
              </Badge>
            ) : (
              <span className="text-gray-400"> - </span>
            )}
          </Detail>
          <Detail label="Plan">
            <span className="capitalize">{user.subscription_plan ?? "Starter"}</span>
            {user.is_beta_user && (
              <span className="ml-2 text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">
                beta
              </span>
            )}
          </Detail>
          <Detail label="Trial end">{formatDate(user.trial_end)}</Detail>
          <Detail label="Subscription end">{formatDate(user.subscription_end)}</Detail>
          <Detail label="Stripe customer">
            {user.stripe_customer_id ? (
              <a
                href={`https://dashboard.stripe.com/customers/${user.stripe_customer_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-gray-700 hover:text-gray-900"
              >
                {user.stripe_customer_id.slice(0, 16)}…
                <ExternalLink size={12} strokeWidth={1.5} />
              </a>
            ) : (
              <span className="text-gray-400"> - </span>
            )}
          </Detail>
          <Detail label="Signed up">{formatDate(user.created_at)}</Detail>
        </div>
      </Section>

      <Section title="Subscription actions">
        <div className="space-y-3">
          <ActionRow label="Extend trial">
            <input
              type="date"
              value={trialEnd}
              onChange={(e) => setTrialEnd(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
            />
            <button
              onClick={handleExtendTrial}
              className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 cursor-pointer"
            >
              Save trial
            </button>
          </ActionRow>

          <ActionRow label="Comp / mark beta">
            <select
              value={compPlan}
              onChange={(e) => setCompPlan(e.target.value as "pro" | "max")}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
            >
              <option value="pro">Pro</option>
              <option value="max">Max</option>
            </select>
            <button
              onClick={handleComp}
              className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 cursor-pointer"
            >
              Apply comp
            </button>
          </ActionRow>

          <ActionRow label="Cancel at period end">
            <button
              onClick={() => setConfirmCancel(true)}
              disabled={!user.stripe_subscription_id}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Cancel subscription
            </button>
            {!user.stripe_subscription_id && (
              <span className="text-xs text-gray-400">No Stripe subscription</span>
            )}
          </ActionRow>

          <ActionRow label="Link Stripe customer">
            <input
              type="text"
              value={linkCustomerId}
              onChange={(e) => setLinkCustomerId(e.target.value)}
              placeholder="cus_..."
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-44 font-mono"
            />
            <button
              onClick={handleLinkStripe}
              className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 cursor-pointer"
            >
              Link
            </button>
          </ActionRow>

          <ActionRow label="Refund last invoice">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="0.00"
                className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
              />
            </div>
            <button
              onClick={handleRefund}
              disabled={!user.stripe_customer_id}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Refund
            </button>
          </ActionRow>
        </div>
      </Section>

      <Section title="Account actions">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleEnterShadow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            <UserCog size={14} strokeWidth={1.5} />
            Enter shadow mode
          </button>
          <button
            onClick={handlePasswordReset}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            Send password reset
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-3 py-1.5 text-sm border border-red-200 text-red-700 rounded-lg hover:bg-red-50 cursor-pointer"
          >
            Delete user
          </button>
        </div>
      </Section>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel subscription?"
        description="The user will keep access until the end of their current billing period."
        confirmLabel="Cancel sub"
        loadingLabel="Cancelling…"
        onConfirm={handleCancel}
        onCancel={() => setConfirmCancel(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${user.email}?`}
        description="This permanently removes the user and cascades to all their couples, events, invoices, and contracts."
        confirmLabel="Delete user"
        loadingLabel="Deleting…"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500 block mb-1">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-gray-200 rounded-lg px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-base font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className="text-gray-900">{children}</div>
    </div>
  );
}

function ActionRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-500 w-36 flex-shrink-0">{label}</span>
      {children}
    </div>
  );
}

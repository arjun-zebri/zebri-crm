'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';

import {
  cancelAtPeriodEnd,
  compUser,
  extendTrial,
  linkStripeCustomer,
  refundLastInvoice,
} from '@/app/admin/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import type { AdminUser, SubscriptionStatus } from '@/lib/admin/admin-analytics';

const statusVariant: Record<SubscriptionStatus, 'paid' | 'contacted' | 'cancelled' | 'default'> = {
  active: 'paid',
  trialing: 'contacted',
  past_due: 'cancelled',
  cancelled: 'default',
  expired: 'default',
};

function formatDate(iso: string | null) {
  if (!iso) return ' - ';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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

/**
 * Subscription summary (status / plan / trial dates / Stripe links)
 * + the admin levers that mutate them (extend trial, comp,
 * cancel-at-period-end, link Stripe customer, refund last invoice).
 *
 * Every action calls a server action in `app/admin/actions.ts` which
 * (a) goes through `updateEntitlements()` for entitlement writes
 * and (b) records itself in `admin_audit_log` (Phase 13).
 */
export function SubscriptionActionsSection({
  user,
  onRefresh,
}: {
  user: AdminUser;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [trialEnd, setTrialEnd] = useState(toDateInput(user.trial_end));
  const [refundAmount, setRefundAmount] = useState('');
  const [compPlan, setCompPlan] = useState<'pro' | 'max'>(
    (user.subscription_plan as 'pro' | 'max') ?? 'pro',
  );
  const [linkCustomerId, setLinkCustomerId] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  const handleExtendTrial = async () => {
    try {
      const iso = new Date(trialEnd + 'T00:00:00').toISOString();
      await extendTrial(user.id, iso);
      toast('Trial extended');
      onRefresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to extend trial', 'error');
    }
  };

  const handleComp = async () => {
    try {
      await compUser(user.id, compPlan);
      toast(`Comped on ${compPlan.toUpperCase()}`);
      onRefresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to comp user', 'error');
    }
  };

  const handleCancel = async () => {
    setConfirmCancel(false);
    try {
      await cancelAtPeriodEnd(user.id);
      toast('Subscription will cancel at period end');
      onRefresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to cancel', 'error');
    }
  };

  const handleRefund = async () => {
    const dollars = parseFloat(refundAmount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      toast('Enter a valid amount', 'error');
      return;
    }
    try {
      const result = await refundLastInvoice(user.id, Math.round(dollars * 100));
      toast(`Refund ${result.status ?? 'submitted'}`);
      setRefundAmount('');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to refund', 'error');
    }
  };

  const handleLinkStripe = async () => {
    if (!linkCustomerId.trim()) {
      toast('Paste the Stripe customer ID', 'error');
      return;
    }
    try {
      const result = await linkStripeCustomer(user.id, linkCustomerId);
      toast(
        result.subscriptionId
          ? `Linked: ${result.plan ?? '?'} (${result.status ?? '?'})`
          : 'Customer linked, no subscription found',
      );
      setLinkCustomerId('');
      onRefresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to link Stripe customer', 'error');
    }
  };

  return (
    <>
      <section>
        <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted mb-2">
          Subscription
        </h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Detail label="Status">
            {user.subscription_status ? (
              <Badge variant={statusVariant[user.subscription_status]}>
                {user.subscription_status.replace('_', ' ')}
              </Badge>
            ) : (
              <span className="text-text-subtle"> - </span>
            )}
          </Detail>
          <Detail label="Plan">
            <span className="capitalize">{user.subscription_plan ?? 'Starter'}</span>
            {user.is_beta_user && (
              <span className="ml-2 text-xs bg-warning/10 text-warning px-1.5 py-0.5 rounded">
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
                className="inline-flex items-center gap-1 text-text hover:text-text-muted"
              >
                {user.stripe_customer_id.slice(0, 16)}…
                <ExternalLink size={12} strokeWidth={1.5} />
              </a>
            ) : (
              <span className="text-text-subtle"> - </span>
            )}
          </Detail>
          <Detail label="Signed up">{formatDate(user.created_at)}</Detail>
        </div>
      </section>

      <section>
        <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted mb-2">
          Subscription actions
        </h3>
        <div className="space-y-3">
          <ActionRow label="Extend trial">
            <Input
              type="date"
              value={trialEnd}
              onChange={(e) => setTrialEnd(e.target.value)}
              size="sm"
            />
            <Button onClick={handleExtendTrial} size="sm">
              Save trial
            </Button>
          </ActionRow>

          <ActionRow label="Comp / mark beta">
            <Select
              value={compPlan}
              onValueChange={(v) => setCompPlan(v as 'pro' | 'max')}
              size="sm"
              options={[
                { value: 'pro', label: 'Pro' },
                { value: 'max', label: 'Max' },
              ]}
            />
            <Button onClick={handleComp} size="sm">
              Apply comp
            </Button>
          </ActionRow>

          <ActionRow label="Cancel at period end">
            <Button
              onClick={() => setConfirmCancel(true)}
              disabled={!user.stripe_subscription_id}
              variant="secondary"
              size="sm"
            >
              Cancel subscription
            </Button>
            {!user.stripe_subscription_id && (
              <span className="text-xs text-text-subtle">No Stripe subscription</span>
            )}
          </ActionRow>

          <ActionRow label="Link Stripe customer">
            <Input
              type="text"
              value={linkCustomerId}
              onChange={(e) => setLinkCustomerId(e.target.value)}
              placeholder="cus_..."
              className="w-44 font-mono"
              size="sm"
            />
            <Button onClick={handleLinkStripe} size="sm">
              Link
            </Button>
          </ActionRow>

          <ActionRow label="Refund last invoice">
            <div className="flex items-center gap-1">
              <span className="text-xs text-text-muted">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="0.00"
                className="w-24"
                size="sm"
              />
            </div>
            <Button
              onClick={handleRefund}
              disabled={!user.stripe_customer_id}
              variant="secondary"
              size="sm"
            >
              Refund
            </Button>
          </ActionRow>
        </div>
      </section>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel subscription?"
        description="The user will keep access until the end of their current billing period."
        confirmLabel="Cancel sub"
        loadingLabel="Cancelling…"
        onConfirm={handleCancel}
        onCancel={() => setConfirmCancel(false)}
      />
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-text-muted mb-0.5">{label}</div>
      <div className="text-text">{children}</div>
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
      <span className="text-xs text-text-muted w-36 flex-shrink-0">{label}</span>
      {children}
    </div>
  );
}

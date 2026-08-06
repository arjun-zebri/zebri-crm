'use client';

import { ExternalLink } from 'lucide-react';
import { useState } from 'react';

import {
  cancelAtPeriodEnd,
  compUser,
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

/**
 * Subscription summary (status / plan / renewal date / Stripe link)
 * + the admin levers that mutate it: comp, cancel-at-period-end, link
 * Stripe customer, refund last invoice.
 *
 * Trials were removed from the signup flow in Phase 1; the
 * `extendTrial` server action was dropped in Phase 13.1. Comping a
 * user grants paid-plan access without a fake trial window.
 */
export function SubscriptionActionsSection({
  user,
  onRefresh,
}: {
  user: AdminUser;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [refundAmount, setRefundAmount] = useState('');
  const [compPlan, setCompPlan] = useState<'pro' | 'max'>(
    (user.subscription_plan as 'pro' | 'max') ?? 'pro',
  );
  const [linkCustomerId, setLinkCustomerId] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showLinkStripe, setShowLinkStripe] = useState(false);

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
      setShowLinkStripe(false);
      onRefresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to link Stripe customer', 'error');
    }
  };

  return (
    <section>
      <h3 className="text-caption font-medium uppercase tracking-wide text-text-muted mb-3">
        Subscription
      </h3>

      {/* Summary — clean 2-column property grid, no boxed inputs. */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-body mb-5">
        <Property label="Status">
          {user.subscription_status ? (
            <Badge variant={statusVariant[user.subscription_status]}>
              {user.subscription_status.replace('_', ' ')}
            </Badge>
          ) : (
            <span className="text-text-subtle">—</span>
          )}
        </Property>
        <Property label="Plan">
          <span className="capitalize text-text">{user.subscription_plan ?? 'Starter'}</span>
          {user.is_comped && (
            <span className="ml-2 text-caption text-text-muted">(comped)</span>
          )}
          {user.is_beta_user && (
            <span className="ml-2 text-caption text-text-muted">(beta)</span>
          )}
        </Property>
        <Property label={user.cancel_at_period_end ? 'Access ends' : 'Renews'}>
          <span className="text-text">{formatDate(user.subscription_end)}</span>
        </Property>
        <Property label="Signed up">
          <span className="text-text">{formatDate(user.created_at)}</span>
        </Property>
        <Property label="Stripe customer">
          {user.stripe_customer_id ? (
            <a
              href={`https://dashboard.stripe.com/customers/${user.stripe_customer_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-text hover:text-text-muted text-body font-mono"
            >
              {user.stripe_customer_id.slice(0, 16)}…
              <ExternalLink size={12} strokeWidth={1.5} />
            </a>
          ) : (
            <span className="text-text-subtle">—</span>
          )}
        </Property>
      </dl>

      {/* Actions — primary safe operations grouped together. */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={compPlan}
            onValueChange={(v) => setCompPlan(v as 'pro' | 'max')}
            size="sm"
            options={[
              { value: 'pro', label: 'Pro' },
              { value: 'max', label: 'Max' },
            ]}
            className="w-24"
          />
          <Button onClick={handleComp} size="sm">
            Comp user
          </Button>
          <Button
            onClick={() => setConfirmCancel(true)}
            disabled={!user.stripe_subscription_id}
            variant="secondary"
            size="sm"
          >
            Cancel at period end
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption text-text-muted">Refund last invoice</span>
          <span className="text-caption text-text-muted">$</span>
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
          <Button
            onClick={handleRefund}
            disabled={!user.stripe_customer_id}
            variant="secondary"
            size="sm"
          >
            Refund
          </Button>
        </div>

        {/* Link Stripe customer — collapsed; for the legacy reconnection case only. */}
        {!showLinkStripe ? (
          <button
            type="button"
            onClick={() => setShowLinkStripe(true)}
            className="text-caption text-text-muted hover:text-text underline cursor-pointer"
          >
            Link Stripe customer
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
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
            <button
              type="button"
              onClick={() => {
                setShowLinkStripe(false);
                setLinkCustomerId('');
              }}
              className="text-caption text-text-muted hover:text-text cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel subscription?"
        description="The user will keep access until the end of their current billing period."
        confirmLabel="Cancel sub"
        loadingLabel="Cancelling…"
        onConfirm={handleCancel}
        onCancel={() => setConfirmCancel(false)}
      />
    </section>
  );
}

function Property({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-caption text-text-muted mb-0.5">{label}</dt>
      <dd className="text-text">{children}</dd>
    </div>
  );
}

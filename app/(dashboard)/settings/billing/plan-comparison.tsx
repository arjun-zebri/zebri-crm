/**
 * Plan comparison dialog — focused modal that opens from the
 * "Manage subscription" / "Compare plans" buttons.
 *
 * Compact 3-column feature table. Switch-plan actions call the
 * `switchPlanAction` server action directly (no Stripe Portal
 * round-trip); after success the parent triggers webhook-polling
 * via `onAfterAction` and the modal closes.
 *
 * For users without an active subscription (Starter / expired),
 * the switch buttons fall back to the Checkout flow.
 *
 * @module app/(dashboard)/settings/billing/plan-comparison
 */
'use client';

import { Check, Minus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';

import { createPlanChangeSessionAction } from './actions';
import { COMPARISON_ROWS, PLANS, type ComparisonCell, type PlanId } from './plans';

export interface PlanComparisonDialogProps {
  open: boolean;
  onClose: () => void;
  currentPlan: PlanId | null;
  isSubscribed: boolean;
  cancelAtPeriodEnd: boolean;
}

export function PlanComparisonDialog({
  open,
  onClose,
  currentPlan,
  isSubscribed,
  cancelAtPeriodEnd,
}: PlanComparisonDialogProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<PlanId | null>(null);

  async function action(planId: PlanId) {
    if (planId === 'starter') {
      toast('Use the Cancel subscription option to downgrade to Starter.', 'error');
      return;
    }
    setBusy(planId);
    try {
      if (isSubscribed && !cancelAtPeriodEnd) {
        // Existing subscriber — hand off to Stripe Portal's hosted
        // confirmation flow so the user sees the proration breakdown
        // and explicitly confirms the charge (upgrades) or credit
        // (downgrades) before it goes through.
        const result = await createPlanChangeSessionAction(planId);
        if (result.url) {
          window.location.assign(result.url);
          return;
        }
        toast(result.error ?? 'Could not start plan change.', 'error');
        setBusy(null);
        return;
      }
      // No active subscription (Starter / expired) OR scheduled
      // cancellation — go through Checkout to set up the new
      // subscription. Stripe will redirect back to /settings?tab=
      // billing&checkout=success which triggers the activation poll.
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.url) window.location.assign(data.url);
      else {
        toast('Could not start checkout. Please try again.', 'error');
        setBusy(null);
      }
    } catch {
      toast('Could not connect. Try again in a moment.', 'error');
      setBusy(null);
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Compare plans" size="xl">
      <div className="overflow-x-auto">
        {/* table-fixed + explicit widths so the action-row button
            loading state can't widen its column mid-click. */}
        <table className="w-full table-fixed text-body">
          <colgroup>
            <col className="w-2/5" />
            <col className="w-1/5" />
            <col className="w-1/5" />
            <col className="w-1/5" />
          </colgroup>
          <thead>
            <tr className="border-b border-border">
              <th className="px-2 py-3 text-left text-caption font-medium uppercase tracking-wide text-text-muted">
                Feature
              </th>
              {PLANS.map((plan) => {
                const isCurrent = plan.id === currentPlan;
                return (
                  <th
                    key={plan.id}
                    className={`px-4 py-3 text-left font-medium ${
                      isCurrent ? 'bg-surface-muted' : ''
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-2 text-text">
                        {plan.name}
                        {isCurrent ? (
                          <span className="rounded-pill border border-border bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-muted">
                            Current
                          </span>
                        ) : null}
                      </span>
                      <span className="text-caption font-normal text-text-muted">
                        {plan.price ? `${plan.price}${plan.period}` : 'Free'}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.filter((r) => r.label !== 'Price').map((row, i, arr) => (
              <tr
                key={row.label}
                className={i < arr.length - 1 ? 'border-b border-border/50' : ''}
              >
                <th
                  scope="row"
                  className="px-2 py-2.5 text-left text-body font-normal text-text-muted"
                >
                  {row.label}
                </th>
                {PLANS.map((plan) => {
                  const cell = row.values[plan.id];
                  const isCurrent = plan.id === currentPlan;
                  return (
                    <td
                      key={plan.id}
                      className={`px-4 py-2.5 ${isCurrent ? 'bg-surface-muted' : ''}`}
                    >
                      <CellView cell={cell} />
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Action row */}
            <tr className="border-t border-border">
              <th className="px-2 py-4" aria-hidden />
              {PLANS.map((plan) => {
                const isCurrent = plan.id === currentPlan;
                if (isCurrent) {
                  return (
                    <td key={plan.id} className="bg-surface-muted px-4 py-4 text-body text-text-muted">
                      Your plan
                    </td>
                  );
                }
                if (plan.id === 'starter') {
                  // Downgrade to starter happens via the Cancel flow.
                  return (
                    <td key={plan.id} className="px-4 py-4 text-caption text-text-muted">
                      <span>Use Cancel to downgrade</span>
                    </td>
                  );
                }
                return (
                  <td key={plan.id} className="px-4 py-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => action(plan.id)}
                      loading={busy === plan.id}
                      className="w-full"
                    >
                      {isSubscribed && !cancelAtPeriodEnd
                        ? `Switch to ${plan.name}`
                        : `Subscribe to ${plan.name}`}
                    </Button>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function CellView({ cell }: { cell: ComparisonCell }) {
  if (cell === true) {
    return <Check size={16} strokeWidth={1.5} className="text-text" aria-label="Included" />;
  }
  if (cell === false) {
    return <Minus size={16} strokeWidth={1.5} className="text-text-subtle" aria-label="Not included" />;
  }
  if (cell === 'soon') {
    return (
      <span className="rounded-pill border border-border bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-muted">
        Soon
      </span>
    );
  }
  return <span className="text-body text-text">{cell}</span>;
}

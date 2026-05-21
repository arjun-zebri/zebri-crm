/**
 * Plan comparison dialog — focused modal that opens from the
 * "Change plan" button.
 *
 * 3-column feature table with fixed widths so the per-column tint
 * stays put when buttons enter their loading state. The action row
 * at the bottom carries the actual switch buttons; the column
 * headers stay quiet (no "Current" pill — the bottom row is
 * unambiguous already).
 *
 * Plan-switch buttons hand off to Stripe's hosted
 * `subscription_update_confirm` flow (the
 * `createPlanChangeSessionAction` server action returns a Portal
 * URL we redirect to). The Starter column's button delegates back
 * to the parent's cancel-confirm modal via `onRequestCancel`.
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
  /** Hand back to the parent to open the shared cancel-confirm modal
   *  when the user clicks Cancel in the Starter column. */
  onRequestCancel: () => void;
}

export function PlanComparisonDialog({
  open,
  onClose,
  currentPlan,
  isSubscribed,
  cancelAtPeriodEnd,
  onRequestCancel,
}: PlanComparisonDialogProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<PlanId | null>(null);

  async function switchTo(planId: 'pro' | 'max') {
    setBusy(planId);
    try {
      if (isSubscribed && !cancelAtPeriodEnd) {
        const result = await createPlanChangeSessionAction(planId);
        if (result.url) {
          window.location.assign(result.url);
          return;
        }
        toast(result.error ?? 'Could not start plan change.', 'error');
        setBusy(null);
        return;
      }
      // No active subscription — go through Checkout to set up a new one.
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

  function handleStarter() {
    onClose();
    onRequestCancel();
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Compare plans" size="xl" flushBottom>
      {/* `min-w-[36rem]` forces horizontal scroll on phones rather than
          squishing the columns into illegibility. table-fixed +
          colgroup keep the three plan columns equal-width and prevent
          loading-state reflow. flushBottom on the Modal removes the
          body's pb so the current-column tint reaches the rounded
          bottom edge. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] table-fixed border-collapse text-body">
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
                      <span className="text-text">{plan.name}</span>
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
            {/* Action row — pb-6 since the modal's pb-4 is consumed
                by `-mb-4` on the scroll container above. */}
            <tr className="border-t border-border">
              <th className="px-2 pb-6 pt-4" aria-hidden />
              {PLANS.map((plan) => {
                const isCurrent = plan.id === currentPlan;
                if (isCurrent) {
                  // Render a button-shaped span so "Current" sits at
                  // the same height/position as the Switch + Cancel
                  // buttons in the other columns — same h-8 footprint,
                  // same text-caption font weight, just no button
                  // chrome (the column tint already signals which is
                  // current).
                  return (
                    <td
                      key={plan.id}
                      className="bg-surface-muted px-4 pb-6 pt-4"
                    >
                      <span className="inline-flex h-8 w-full items-center justify-center text-caption font-medium text-text">
                        Current
                      </span>
                    </td>
                  );
                }
                return (
                  <td key={plan.id} className="px-4 pb-6 pt-4">
                    {plan.id === 'starter' ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleStarter}
                        className="w-full whitespace-nowrap"
                      >
                        Cancel
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => switchTo(plan.id as 'pro' | 'max')}
                        loading={busy === plan.id}
                        className="w-full whitespace-nowrap"
                      >
                        Switch
                      </Button>
                    )}
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

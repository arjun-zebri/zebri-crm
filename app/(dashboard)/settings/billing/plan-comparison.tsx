/**
 * Plan comparison dialog: focused modal that opens from the
 * "Change plan" button.
 *
 * 3-column feature table with fixed widths so the per-column tint
 * stays put when buttons enter their loading state. The action row
 * at the bottom carries the actual switch buttons; the column
 * headers stay quiet (no "Current" pill: the bottom row is
 * unambiguous already).
 *
 * The "current" column's tint is rendered as an absolutely
 * positioned div behind the table (not as per-cell `bg-`) so it
 * fills the entire modal body: including the empty space below the
 * table content that the body's `flex-1` expands into. This is the
 * only way to make the tint reach the modal's rounded bottom edge
 * regardless of how tall the body ends up being.
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
  onRequestCancel: () => void;
}

// Column 1 = feature labels (40%). Plans take 20% each, starting at
// 40% / 60% / 80% from the left of the table.
const TINT_LEFT: Record<PlanId, string> = {
  starter: '40%',
  pro: '60%',
  max: '80%',
};

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
      {/* Outer: overflow-x-auto handles mobile horizontal scroll.
          Inner relative wrapper holds the absolute-positioned tint
          and the table. Body is now content-sized (flushBottom on
          Modal drops flex-1) so the inner wrapper's height equals
          the table height equals the body height, the abs tint at
          inset-y-0 reaches the modal's rounded-control bottom edge. */}
      <div className="overflow-x-auto">
        <div className="relative min-w-[36rem]">
          {currentPlan ? (
            <div
              aria-hidden
              className="absolute inset-y-0 w-1/5 bg-surface-muted"
              style={{ left: TINT_LEFT[currentPlan] }}
            />
          ) : null}

          <table className="relative w-full table-fixed border-collapse text-body">
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
                {PLANS.map((plan) => (
                  <th key={plan.id} className="px-4 py-3 text-left font-medium">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-text">{plan.name}</span>
                      <span className="text-caption font-normal text-text-muted">
                        {plan.price ? `${plan.price}${plan.period}` : 'Free'}
                      </span>
                    </div>
                  </th>
                ))}
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
                  {PLANS.map((plan) => (
                    <td key={plan.id} className="px-4 py-2.5">
                      <CellView cell={row.values[plan.id]} />
                    </td>
                  ))}
                </tr>
              ))}
              {/* Action row */}
              <tr className="border-t border-border">
                <th className="px-2 pb-6 pt-4" aria-hidden />
                {PLANS.map((plan) => {
                  const isCurrent = plan.id === currentPlan;
                  if (isCurrent) {
                    return (
                      <td key={plan.id} className="px-4 pb-6 pt-4">
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

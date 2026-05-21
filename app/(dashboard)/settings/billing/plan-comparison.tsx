/**
 * Plan comparison dialog — focused modal that opens from the
 * "Compare plans" link on the current-plan card.
 *
 * Compact 3-column feature table with the user's current column
 * highlighted. Switch-plan actions live in a row at the bottom as
 * quiet ghost buttons. Closing the modal returns to the calm main
 * flow.
 *
 * @module app/(dashboard)/settings/billing/plan-comparison
 */
'use client';

import { Check, Minus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';

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
  const [redirecting, setRedirecting] = useState<PlanId | null>(null);

  async function action(planId: PlanId) {
    setRedirecting(planId);
    try {
      const path =
        isSubscribed && !cancelAtPeriodEnd ? '/api/stripe/portal' : '/api/stripe/checkout';
      const body =
        isSubscribed && !cancelAtPeriodEnd ? undefined : JSON.stringify({ plan: planId });
      const res = await fetch(path, {
        method: 'POST',
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (data.url) window.location.assign(data.url);
      else {
        toast('Could not start that flow. Please try again.', 'error');
        setRedirecting(null);
      }
    } catch {
      toast('Could not connect. Try again in a moment.', 'error');
      setRedirecting(null);
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Compare plans" size="xl">
      <div className="overflow-x-auto">
        <table className="w-full text-body">
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
                const isStarter = plan.id === 'starter';
                return (
                  <td key={plan.id} className="px-4 py-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => action(plan.id)}
                      loading={redirecting === plan.id}
                    >
                      {isStarter ? 'Downgrade' : `Switch to ${plan.name}`}
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

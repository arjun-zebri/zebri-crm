/**
 * Plan comparison — compact feature table.
 *
 * Replaces the previous 3-column feature-list grid. Each tier is a
 * column, each feature a row; cells render boolean ✓ / —,
 * "Soon" pill, or a literal string ("$49/mo", "5", "Unlimited").
 *
 * Tighter than the previous 3-card layout; the user's current plan
 * column is highlighted with a soft surface tint + "CURRENT" pill.
 * Switch-plan actions live in a row at the bottom as quiet ghost
 * buttons — no shouty colour CTAs.
 *
 * @module app/(dashboard)/settings/billing/plan-comparison
 */
'use client';

import { Check, Minus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

import { COMPARISON_ROWS, PLANS, type ComparisonCell, type PlanId } from './plans';

export interface PlanComparisonProps {
  currentPlan: PlanId | null;
  isSubscribed: boolean;
  cancelAtPeriodEnd: boolean;
}

export function PlanComparison({ currentPlan, isSubscribed, cancelAtPeriodEnd }: PlanComparisonProps) {
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
    <section className="rounded-card border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full text-body">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 bg-surface px-5 py-3 text-left text-caption font-medium uppercase tracking-wide text-text-muted">
                Feature
              </th>
              {PLANS.map((plan) => {
                const isCurrent = plan.id === currentPlan;
                return (
                  <th
                    key={plan.id}
                    className={`px-5 py-3 text-left font-medium ${
                      isCurrent ? 'bg-surface-muted' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-text">{plan.name}</span>
                      {isCurrent ? (
                        <span className="rounded-pill bg-text px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-inverse">
                          Current
                        </span>
                      ) : null}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row, i) => (
              <tr
                key={row.label}
                className={i < COMPARISON_ROWS.length - 1 ? 'border-b border-border/60' : ''}
              >
                <th
                  scope="row"
                  className="sticky left-0 bg-surface px-5 py-2.5 text-left text-body font-normal text-text-muted"
                >
                  {row.label}
                </th>
                {PLANS.map((plan) => {
                  const cell = row.values[plan.id];
                  const isCurrent = plan.id === currentPlan;
                  return (
                    <td
                      key={plan.id}
                      className={`px-5 py-2.5 ${isCurrent ? 'bg-surface-muted' : ''}`}
                    >
                      <CellView cell={cell} />
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Action row */}
            <tr className="border-t border-border">
              <th className="sticky left-0 bg-surface px-5 py-3" aria-hidden />
              {PLANS.map((plan) => {
                const isCurrent = plan.id === currentPlan;
                const isStarter = plan.id === 'starter';
                if (isCurrent) {
                  return (
                    <td
                      key={plan.id}
                      className={`px-5 py-3 text-caption text-text-subtle ${
                        isCurrent ? 'bg-surface-muted' : ''
                      }`}
                    >
                      —
                    </td>
                  );
                }
                return (
                  <td key={plan.id} className="px-5 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => action(plan.id)}
                      loading={redirecting === plan.id}
                      className="border border-border"
                    >
                      {isStarter
                        ? 'Downgrade'
                        : isSubscribed
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
    </section>
  );
}

function CellView({ cell }: { cell: ComparisonCell }) {
  if (cell === true) {
    return <Check size={14} strokeWidth={1.5} className="text-text" aria-label="Included" />;
  }
  if (cell === false) {
    return <Minus size={14} strokeWidth={1.5} className="text-text-subtle" aria-label="Not included" />;
  }
  if (cell === 'soon') {
    return (
      <span className="rounded-pill border border-border px-1.5 py-0.5 text-[10px] text-text-muted">
        Soon
      </span>
    );
  }
  return <span className="text-text">{cell}</span>;
}

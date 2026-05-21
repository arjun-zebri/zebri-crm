/**
 * Plan comparison — the expandable 3-tier feature matrix.
 *
 * Quietly hidden by default behind the "Compare plans" link on the
 * current-plan card. Token-driven, no promotional badges; uses a
 * single neutral border per card and a subtle highlight on the
 * user's current plan.
 *
 * @module app/(dashboard)/settings/billing/plan-comparison
 */
'use client';

import { Check, Minus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

import { PLANS, type PlanId } from './plans';

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
      // Subscribers route through the Stripe portal so they can up/downgrade
      // through Stripe's UI (avoids us hand-building the proration flow).
      // New users go through checkout.
      const path = isSubscribed && !cancelAtPeriodEnd ? '/api/stripe/portal' : '/api/stripe/checkout';
      const body = isSubscribed && !cancelAtPeriodEnd ? undefined : JSON.stringify({ plan: planId });
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
    <section className="rounded-card border border-border bg-surface p-5 sm:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          return (
            <div
              key={plan.id}
              className={`rounded-card border p-5 ${
                isCurrent ? 'border-text bg-surface-muted' : 'border-border bg-surface'
              }`}
            >
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-body font-semibold text-text">{plan.name}</h3>
                {isCurrent ? (
                  <span className="text-caption uppercase tracking-wide text-text-muted">
                    Current
                  </span>
                ) : null}
              </div>

              <div className="mb-1 flex items-baseline gap-0.5">
                <span className="text-section font-semibold text-text">
                  {plan.price ?? 'Free'}
                </span>
                {plan.period ? <span className="text-caption text-text-muted">{plan.period}</span> : null}
              </div>

              <p className="mb-5 text-caption text-text-muted">{plan.tagline}</p>

              {plan.id === 'starter' ? (
                isCurrent ? (
                  <div className="mb-4 h-9 text-caption text-text-subtle">No action</div>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => action(plan.id)}
                    loading={redirecting === plan.id}
                    className="mb-4 w-full"
                  >
                    Downgrade
                  </Button>
                )
              ) : isCurrent ? (
                <div className="mb-4 h-9 text-caption text-text-subtle">No action</div>
              ) : (
                <Button
                  variant={isSubscribed ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => action(plan.id)}
                  loading={redirecting === plan.id}
                  className="mb-4 w-full"
                >
                  {isSubscribed ? 'Switch to ' + plan.name : 'Subscribe to ' + plan.name}
                </Button>
              )}

              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f.label} className="flex items-start gap-2 text-caption">
                    {f.included ? (
                      <Check size={14} strokeWidth={1.5} className="mt-0.5 shrink-0 text-text" />
                    ) : (
                      <Minus size={14} strokeWidth={1.5} className="mt-0.5 shrink-0 text-text-subtle" />
                    )}
                    <span className={f.included ? 'text-text' : 'text-text-subtle'}>
                      {f.label}
                      {f.soon ? (
                        <span className="ml-1.5 rounded-pill border border-border px-1.5 py-0.5 text-[10px] text-text-muted">
                          Soon
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

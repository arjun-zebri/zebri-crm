/**
 * Plans & Billing tab — orchestrator.
 *
 * Composes three section components in a single stack:
 *   1. CurrentPlanCard — the user's current state (8 variants).
 *   2. BillingHistory — past Stripe invoices + next charge.
 *   3. PlanComparison — expandable 3-tier feature matrix (hidden
 *      by default; revealed by the "Compare plans" link on the
 *      current-plan card).
 *
 * Redesigned in Phase 1: low-chrome, info-first, single primary CTA
 * per state. The previous 3-card promotional grid moved into the
 * expandable comparison panel.
 *
 * @module app/(dashboard)/settings/billing-section
 */
'use client';

import { CheckCircle2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { BillingHistory } from './billing/billing-history';
import { CurrentPlanCard } from './billing/current-plan-card';
import { PlanComparison } from './billing/plan-comparison';
import { type PlanId } from './billing/plans';

export interface BillingSectionProps {
  status: string | null;
  trialEnd: string | null;
  subscriptionEnd: string | null;
  subscriptionPlan: string | null;
  hasStripeCustomer: boolean;
  cancelAtPeriodEnd: boolean;
  isSubscribed: boolean;
  isComped: boolean;
}

export function BillingSection(props: BillingSectionProps) {
  const searchParams = useSearchParams();
  const justSubscribed = searchParams.get('checkout') === 'success';
  const [compareOpen, setCompareOpen] = useState(false);

  // The "current plan" is whatever the user is paying for (or free if
  // they aren't). Used to highlight the right column in the comparison.
  const currentPlanForComparison: PlanId =
    props.isSubscribed && !props.cancelAtPeriodEnd
      ? ((props.subscriptionPlan as PlanId) ?? 'pro')
      : 'starter';

  return (
    <div className="max-w-3xl space-y-8">
      {justSubscribed && !props.isSubscribed ? (
        <div className="flex items-center gap-3 rounded-card border border-success/40 bg-success/5 px-4 py-3 text-body text-text">
          <CheckCircle2 size={16} strokeWidth={1.5} className="shrink-0 text-success" />
          Payment successful — your subscription is being activated. This page will update shortly.
        </div>
      ) : null}

      <CurrentPlanCard
        {...props}
        compareOpen={compareOpen}
        onToggleCompare={() => setCompareOpen((v) => !v)}
      />

      {compareOpen ? (
        <PlanComparison
          currentPlan={currentPlanForComparison}
          isSubscribed={props.isSubscribed}
          cancelAtPeriodEnd={props.cancelAtPeriodEnd}
        />
      ) : null}

      {props.hasStripeCustomer ? <BillingHistory /> : null}
    </div>
  );
}

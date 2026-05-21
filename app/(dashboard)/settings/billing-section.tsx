/**
 * Plans & Billing tab — orchestrator.
 *
 * Document-style composition: section labels + thin dividers + clean
 * sections, instead of stacked bordered cards. The 3-tier comparison
 * lives in a focused modal — opens only when the user clicks
 * "Compare plans", so the main flow stays calm.
 *
 * @module app/(dashboard)/settings/billing-section
 */
'use client';

import { CheckCircle2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { BillingHistory } from './billing/billing-history';
import { CurrentPlanCard } from './billing/current-plan-card';
import { PlanComparisonDialog } from './billing/plan-comparison';
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

  // Which plan to highlight as the "current" column in the comparison.
  const currentPlanForComparison: PlanId =
    props.isSubscribed && !props.cancelAtPeriodEnd
      ? ((props.subscriptionPlan as PlanId) ?? 'pro')
      : 'starter';

  return (
    <div className="max-w-3xl space-y-12">
      {justSubscribed && !props.isSubscribed ? (
        <div className="flex items-center gap-3 rounded-card border border-success/40 bg-success/5 px-4 py-3 text-body text-text">
          <CheckCircle2 size={16} strokeWidth={1.5} className="shrink-0 text-success" />
          Payment successful — your subscription is being activated. This page will update shortly.
        </div>
      ) : null}

      <Section label="Plan">
        <CurrentPlanCard {...props} onCompare={() => setCompareOpen(true)} />
      </Section>

      {props.hasStripeCustomer ? (
        <Section label="Billing history">
          <BillingHistory />
        </Section>
      ) : null}

      <PlanComparisonDialog
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        currentPlan={currentPlanForComparison}
        isSubscribed={props.isSubscribed}
        cancelAtPeriodEnd={props.cancelAtPeriodEnd}
      />
    </div>
  );
}

/**
 * Document-style section header — small label on the left + a thin
 * divider line filling the rest of the row.
 */
function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-6 flex items-center gap-4">
        <h3 className="text-caption font-medium uppercase tracking-wide text-text-muted">
          {label}
        </h3>
        <div className="flex-1 border-t border-border" />
      </div>
      {children}
    </section>
  );
}

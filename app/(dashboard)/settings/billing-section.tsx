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
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { createClient } from '@/lib/supabase/client';

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const justSubscribed = searchParams.get('checkout') === 'success';
  const [compareOpen, setCompareOpen] = useState(false);

  // Stripe webhook updates app_metadata asynchronously after checkout
  // completes. The page renders with the stale JWT until the next
  // session refresh — which is why "Payment successful — will update
  // shortly" used to hang forever. Poll refreshSession() every 2s for
  // up to 30s when we're in the post-checkout window; as soon as the
  // refreshed JWT carries `is_subscribed: true` (or any active state),
  // strip `?checkout=success` and `router.refresh()` to re-fetch the
  // parent settings page with the new app_metadata.
  useEffect(() => {
    if (!justSubscribed) return;
    if (props.isSubscribed) {
      // Already settled — drop the query param so a manual refresh
      // doesn't re-show the banner.
      router.replace('/settings?tab=billing');
      return;
    }
    // The parent settings page fetches the user once in its own
    // `useEffect`; it doesn't subscribe to auth state changes. So when
    // the Stripe webhook lands and updates app_metadata, we have to
    // (a) refresh the local JWT to pick up the new claims and (b) do
    // a full reload to re-run the parent's user fetch. Poll every 2s
    // for up to 30s.
    const supabase = createClient();
    let cancelled = false;
    const start = Date.now();
    async function tick() {
      if (cancelled) return;
      await supabase.auth.refreshSession();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const nowSubscribed = Boolean(user?.app_metadata?.is_subscribed);
      if (cancelled) return;
      if (nowSubscribed) {
        window.location.assign('/settings?tab=billing');
        return;
      }
      if (Date.now() - start > 30_000) return; // give up after 30s
      window.setTimeout(tick, 2000);
    }
    void tick();
    return () => {
      cancelled = true;
    };
  }, [justSubscribed, props.isSubscribed, router]);

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
          Payment successful — finalising your subscription…
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

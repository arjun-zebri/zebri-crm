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

import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
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

type ActivationState = 'idle' | 'polling' | 'timed_out';

export function BillingSection(props: BillingSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justSubscribed = searchParams.get('checkout') === 'success';
  const [compareOpen, setCompareOpen] = useState(false);
  const [activation, setActivation] = useState<ActivationState>('idle');
  const [refreshing, setRefreshing] = useState(false);

  // Stripe webhook updates `app_metadata` asynchronously after checkout
  // completes. Poll refreshSession() + getUser() until the refreshed
  // JWT carries `is_subscribed: true`, then do a full reload so the
  // parent settings page re-fetches user data with the new metadata.
  //
  // Polling for 60s gives the webhook a generous window. After that
  // we surface a manual "Refresh" button — the most common failure in
  // local dev is "I forgot to start `stripe listen`", and the user
  // needs an out that doesn't require closing the tab.
  useEffect(() => {
    if (!justSubscribed) return;
    if (props.isSubscribed) {
      router.replace('/settings?tab=billing');
      return;
    }
    setActivation('polling');
    const supabase = createClient();
    let cancelled = false;
    const start = Date.now();
    let attempt = 0;
    async function tick() {
      if (cancelled) return;
      attempt += 1;
      try {
        await supabase.auth.refreshSession();
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error) {
          console.warn('[billing] getUser error during activation poll', error);
        }
        const meta = (user?.app_metadata ?? {}) as {
          is_subscribed?: boolean;
          subscription_status?: string;
        };
        const nowSubscribed =
          meta.is_subscribed === true ||
          meta.subscription_status === 'active' ||
          meta.subscription_status === 'trialing';
        console.warn('[billing] activation poll', {
          attempt,
          elapsedMs: Date.now() - start,
          subscription_status: meta.subscription_status,
          is_subscribed: meta.is_subscribed,
          nowSubscribed,
        });
        if (cancelled) return;
        if (nowSubscribed) {
          window.location.assign('/settings?tab=billing');
          return;
        }
      } catch (err) {
        console.warn('[billing] activation poll threw', err);
      }
      if (cancelled) return;
      if (Date.now() - start > 60_000) {
        setActivation('timed_out');
        return;
      }
      window.setTimeout(tick, 2000);
    }
    void tick();
    return () => {
      cancelled = true;
    };
  }, [justSubscribed, props.isSubscribed, router]);

  async function manualRefresh() {
    setRefreshing(true);
    try {
      const supabase = createClient();
      await supabase.auth.refreshSession();
    } finally {
      // Force a full reload regardless — picks up new app_metadata via
      // the parent's user fetch.
      window.location.assign('/settings?tab=billing');
    }
  }

  // Which plan to highlight as the "current" column in the comparison.
  const currentPlanForComparison: PlanId =
    props.isSubscribed && !props.cancelAtPeriodEnd
      ? ((props.subscriptionPlan as PlanId) ?? 'pro')
      : 'starter';

  return (
    <div className="max-w-3xl space-y-12">
      {justSubscribed && !props.isSubscribed ? (
        <ActivationBanner
          activation={activation}
          refreshing={refreshing}
          onRefresh={manualRefresh}
        />
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

/* ────────────────────────────────────────────────────────────── */

function ActivationBanner({
  activation,
  refreshing,
  onRefresh,
}: {
  activation: ActivationState;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  if (activation === 'timed_out') {
    return (
      <div className="flex flex-col gap-3 rounded-card border border-warning/40 bg-warning/5 px-4 py-3 text-body text-text sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertCircle size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-warning" />
          <div>
            <p>Payment successful, but we haven&apos;t received the activation event yet.</p>
            <p className="mt-1 text-caption text-text-muted">
              This usually clears in a moment — try refreshing. If it persists, the Stripe webhook
              may not be reaching the app (local dev: ensure <code className="font-mono">stripe
              listen --forward-to localhost:3000/api/stripe/webhook</code> is running).
            </p>
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={onRefresh} loading={refreshing}>
          Refresh
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-card border border-success/40 bg-success/5 px-4 py-3 text-body text-text sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {activation === 'polling' ? (
          <Loader2 size={16} strokeWidth={1.5} className="shrink-0 animate-spin text-success" />
        ) : (
          <CheckCircle2 size={16} strokeWidth={1.5} className="shrink-0 text-success" />
        )}
        Payment successful — finalising your subscription…
      </div>
      <Button size="sm" variant="ghost" onClick={onRefresh} loading={refreshing}>
        Refresh now
      </Button>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */

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

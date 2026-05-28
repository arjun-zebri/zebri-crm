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
import { useToast } from '@/components/ui/toast';
import { createClient } from '@/lib/supabase/client';

import { cancelSubscriptionAction } from './billing/actions';
import { BillingHistory } from './billing/billing-history';
import { CancelConfirmModal } from './billing/cancel-confirm-modal';
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
  /** Auth user's `created_at` — surfaced as "Joined {date}" in the
   *  status line so the card carries a little warmth + history. */
  userCreatedAt: string | null;
}

type ActivationState = 'idle' | 'polling' | 'timed_out';

export function BillingSection(props: BillingSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const justSubscribed = searchParams.get('checkout') === 'success';
  const justChanged = searchParams.get('change') === 'success';
  const [compareOpen, setCompareOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [activation, setActivation] = useState<ActivationState>('idle');
  const [refreshing, setRefreshing] = useState(false);
  // A monotonic counter that ticks every time the user takes a
  // subscription action (cancel / resume). It joins `justSubscribed`
  // and `justChanged` as triggers for the post-action polling so any
  // webhook-bound change re-runs the same wait-and-reload flow.
  const [actionTick, setActionTick] = useState(0);
  const pollingTrigger = justSubscribed || justChanged || actionTick > 0;

  // Stripe webhook updates `app_metadata` asynchronously after a
  // subscription change. Poll refreshSession() + getUser() until the
  // refreshed JWT reflects the new state, then do a full reload so
  // the parent settings page re-fetches user data.
  //
  // Polling for 60s gives the webhook a generous window. After that
  // we surface a manual "Refresh" button — the most common failure in
  // local dev is "I forgot to start `stripe listen`", and the user
  // needs an out that doesn't require closing the tab.
  useEffect(() => {
    if (!pollingTrigger) return;
    if ((justSubscribed || justChanged) && props.isSubscribed && justChanged) {
      // Plan change returned but the page already reflects an
      // updated subscription — drop the query param.
      router.replace('/settings?tab=billing');
      return;
    }
    if (justSubscribed && props.isSubscribed) {
      router.replace('/settings?tab=billing');
      return;
    }
    setActivation('polling');
    // Snapshot the metadata at the moment polling starts. The webhook
    // will alter at least one of these fields; once we observe a
    // change we reload.
    const snapshot = {
      subscription_status: props.status ?? '',
      subscription_plan: props.subscriptionPlan ?? '',
      cancel_at_period_end: props.cancelAtPeriodEnd ? '1' : '0',
      is_subscribed: props.isSubscribed ? '1' : '0',
    };
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
          subscription_plan?: string;
          cancel_at_period_end?: boolean;
        };
        const subscriptionLanded =
          meta.is_subscribed === true ||
          meta.subscription_status === 'active' ||
          meta.subscription_status === 'trialing';
        // For checkout completion we wait for active/subscribed. For
        // post-action polling (cancel/resume/switch) we just wait for
        // ANY observable change from the snapshot — webhook updates
        // arrive together so seeing one field flip means the others
        // are fresh too.
        const changed =
          (meta.subscription_status ?? '') !== snapshot.subscription_status ||
          (meta.subscription_plan ?? '') !== snapshot.subscription_plan ||
          (meta.cancel_at_period_end ? '1' : '0') !== snapshot.cancel_at_period_end ||
          (meta.is_subscribed ? '1' : '0') !== snapshot.is_subscribed;
        const done = justSubscribed ? subscriptionLanded : changed;
        console.warn('[billing] activation poll', {
          attempt,
          elapsedMs: Date.now() - start,
          subscription_status: meta.subscription_status,
          subscription_plan: meta.subscription_plan,
          is_subscribed: meta.is_subscribed,
          cancel_at_period_end: meta.cancel_at_period_end,
          done,
        });
        if (cancelled) return;
        if (done) {
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
    // We deliberately don't include the prop fields in the dep array —
    // they're captured into `snapshot` once when polling starts, and
    // we want to keep polling against that snapshot until something
    // changes (or we time out).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollingTrigger, actionTick]);

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

  async function confirmCancel() {
    setCancelBusy(true);
    const result = await cancelSubscriptionAction();
    if (result.error) {
      toast(result.error, 'error');
      setCancelBusy(false);
      return;
    }
    toast('Cancellation scheduled — page will refresh shortly.');
    setCancelOpen(false);
    setCancelBusy(false);
    setActionTick((t) => t + 1);
  }

  // Which plan to highlight as the "current" column in the comparison.
  const currentPlanForComparison: PlanId =
    props.isSubscribed && !props.cancelAtPeriodEnd
      ? ((props.subscriptionPlan as PlanId) ?? 'pro')
      : 'starter';

  // Banner copy is action-aware: "Payment successful" only makes
  // sense after a Stripe Checkout (new subscription / resubscribe).
  // Plan changes + cancel/resume should say "Updating subscription…".
  const bannerKind: 'payment' | 'change' = justSubscribed ? 'payment' : 'change';

  return (
    <div className="max-w-3xl space-y-12">
      {pollingTrigger && activation !== 'idle' ? (
        <ActivationBanner
          kind={bannerKind}
          activation={activation}
          refreshing={refreshing}
          onRefresh={manualRefresh}
        />
      ) : null}

      <Section label="Plan">
        <CurrentPlanCard
          {...props}
          onManagePlan={() => setCompareOpen(true)}
          onRequestCancel={() => setCancelOpen(true)}
          onAfterAction={() => setActionTick((t) => t + 1)}
        />
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
        onRequestCancel={() => setCancelOpen(true)}
      />

      <CancelConfirmModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={confirmCancel}
        busy={cancelBusy}
        subscriptionEnd={props.subscriptionEnd}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */

function ActivationBanner({
  kind,
  activation,
  refreshing,
  onRefresh,
}: {
  kind: 'payment' | 'change';
  activation: ActivationState;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const headline =
    kind === 'payment'
      ? 'Payment successful — finalising your subscription…'
      : 'Updating subscription…';

  if (activation === 'timed_out') {
    return (
      <div className="flex flex-col gap-3 rounded-card border border-warning/40 bg-warning/5 px-4 py-3 text-body text-text sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertCircle size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-warning" />
          <div>
            <p>
              {kind === 'payment'
                ? "Payment successful, but we haven't received the activation event yet."
                : "Your change went through, but we haven't received the update event yet."}
            </p>
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
        {headline}
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

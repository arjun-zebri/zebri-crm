/**
 * Current-plan surface — no outer border, document-style layout.
 *
 * Big confident header (plan name + price). Status indicator with a
 * coloured dot. "What's included" grid as supporting info. Primary
 * action opens the plan-comparison modal (no Stripe portal trip);
 * cancel goes through an app-side confirmation modal; resubscribe
 * is a one-click server action.
 *
 * Starter users see a prominent usage indicator.
 *
 * @module app/(dashboard)/settings/billing/current-plan-card
 */
'use client';

import { AlertCircle, Check } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { createClient } from '@/lib/supabase/client';

import {
  cancelSubscriptionAction,
  paymentMethodPortalAction,
  resumeSubscriptionAction,
} from './actions';
import { formatDate, planById, PLAN_HIGHLIGHTS, type PlanId } from './plans';

export interface CurrentPlanCardProps {
  status: string | null;
  trialEnd: string | null;
  subscriptionEnd: string | null;
  subscriptionPlan: string | null;
  hasStripeCustomer: boolean;
  cancelAtPeriodEnd: boolean;
  isSubscribed: boolean;
  isComped: boolean;
  /** Open the plan-comparison modal. */
  onManagePlan: () => void;
  /** Trigger the post-action polling banner (used after cancel /
   *  resume / switch flows so the page reloads when the webhook lands). */
  onAfterAction: () => void;
}

type CardState =
  | 'starter'
  | 'active'
  | 'cancelling_in_grace'
  | 'past_due'
  | 'expired'
  | 'comped';

function classify(p: CurrentPlanCardProps): CardState {
  if (p.isComped && p.status === 'active') return 'comped';
  if (p.status === 'past_due') return 'past_due';
  if (p.status === 'expired') return 'expired';
  if (p.status === 'active' && p.cancelAtPeriodEnd) return 'cancelling_in_grace';
  if (p.status === 'active' || p.status === 'trialing') return 'active';
  return 'starter';
}

export function CurrentPlanCard(props: CurrentPlanCardProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<
    'subscribe' | 'cancel' | 'resume' | 'payment_method' | null
  >(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const state = classify(props);

  const planId: PlanId =
    state === 'starter' || state === 'expired'
      ? 'starter'
      : (props.subscriptionPlan as PlanId) ?? 'pro';
  const plan = planById(planId);

  async function subscribe(planChoice: PlanId) {
    setBusy('subscribe');
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planChoice }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.url) window.location.assign(data.url);
      else {
        toast('Could not start checkout. Please try again.', 'error');
        setBusy(null);
      }
    } catch {
      toast('Could not start checkout. Please try again.', 'error');
      setBusy(null);
    }
  }

  async function openPaymentMethodPortal() {
    setBusy('payment_method');
    const result = await paymentMethodPortalAction();
    if (result.url) window.location.assign(result.url);
    else {
      toast(result.error ?? 'Could not open billing portal.', 'error');
      setBusy(null);
    }
  }

  async function confirmCancel() {
    setBusy('cancel');
    const result = await cancelSubscriptionAction();
    if (result.error) {
      toast(result.error, 'error');
      setBusy(null);
      return;
    }
    toast('Cancellation scheduled — page will refresh shortly.');
    setShowCancelConfirm(false);
    props.onAfterAction();
  }

  async function resume() {
    setBusy('resume');
    const result = await resumeSubscriptionAction();
    if (result.error) {
      toast(result.error, 'error');
      setBusy(null);
      return;
    }
    toast('Subscription resumed — page will refresh shortly.');
    props.onAfterAction();
  }

  return (
    <div>
      {/* Header — plan name + price */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-section font-semibold text-text">{plan.name}</h2>
          <StatusLine state={state} subscriptionEnd={props.subscriptionEnd} />
        </div>
        <div className="text-right">
          {plan.price ? (
            <>
              <div className="text-section font-semibold text-text">{plan.price}</div>
              <div className="text-caption text-text-muted">per month</div>
            </>
          ) : (
            <div className="text-section font-semibold text-text">Free</div>
          )}
        </div>
      </div>

      {/* Past-due notice */}
      {state === 'past_due' ? (
        <div className="mt-6 inline-flex items-center gap-2 rounded-card border border-danger/40 bg-danger/5 px-3 py-2 text-body text-danger">
          <AlertCircle size={14} strokeWidth={1.5} />
          Update your payment method to restore access.
        </div>
      ) : null}

      {/* What's included */}
      <div className="mt-8">
        <h4 className="mb-3 text-caption font-medium uppercase tracking-wide text-text-muted">
          Includes
        </h4>
        <ul className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
          {PLAN_HIGHLIGHTS[planId].map((h) => (
            <li key={h} className="flex items-start gap-2 text-body text-text">
              <Check size={14} strokeWidth={1.5} className="mt-1 shrink-0 text-text-subtle" />
              {h}
            </li>
          ))}
        </ul>
      </div>

      {/* Starter usage */}
      {state === 'starter' ? (
        <StarterUsage onUpgrade={() => subscribe('pro')} redirecting={busy === 'subscribe'} />
      ) : null}

      {/* Actions */}
      {state === 'comped' ? null : (
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <PrimaryAction
            state={state}
            busy={busy}
            onManagePlan={props.onManagePlan}
            onSubscribe={() => subscribe('pro')}
            onResume={resume}
            onUpdatePayment={openPaymentMethodPortal}
          />
          {/* Secondary text links */}
          {state === 'active' ? (
            <>
              <button
                type="button"
                onClick={openPaymentMethodPortal}
                className="text-body text-text-muted hover:text-text disabled:opacity-50"
                disabled={busy !== null}
              >
                Update payment method
              </button>
              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                className="text-body text-text-muted hover:text-danger disabled:opacity-50"
                disabled={busy !== null}
              >
                Cancel subscription
              </button>
            </>
          ) : null}
        </div>
      )}

      <CancelConfirmModal
        open={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={confirmCancel}
        busy={busy === 'cancel'}
        subscriptionEnd={props.subscriptionEnd}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */

function StatusLine({
  state,
  subscriptionEnd,
}: {
  state: CardState;
  subscriptionEnd: string | null;
}) {
  const tone =
    state === 'past_due'
      ? 'danger'
      : state === 'cancelling_in_grace'
        ? 'warning'
        : state === 'starter' || state === 'expired'
          ? 'muted'
          : 'success';
  const dotClass = {
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    muted: 'bg-text-subtle',
  }[tone];

  const text = (() => {
    switch (state) {
      case 'starter':
        return 'Free plan';
      case 'active':
        return subscriptionEnd ? `Active · Renews ${formatDate(subscriptionEnd)}` : 'Active';
      case 'cancelling_in_grace':
        return subscriptionEnd
          ? `Cancels ${formatDate(subscriptionEnd)}`
          : 'Cancellation scheduled';
      case 'past_due':
        return 'Payment failed';
      case 'expired':
        return 'Subscription ended';
      case 'comped':
        return 'Comped account';
    }
  })();

  return (
    <div className="mt-1 flex items-center gap-2 text-body text-text-muted">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden />
      {text}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */

type BusyKey = 'subscribe' | 'cancel' | 'resume' | 'payment_method' | null;

function PrimaryAction({
  state,
  busy,
  onManagePlan,
  onSubscribe,
  onResume,
  onUpdatePayment,
}: {
  state: CardState;
  busy: BusyKey;
  onManagePlan: () => void;
  onSubscribe: () => void;
  onResume: () => void;
  onUpdatePayment: () => void;
}) {
  switch (state) {
    case 'starter':
    case 'expired':
      return (
        <Button onClick={onSubscribe} loading={busy === 'subscribe'}>
          Upgrade to Pro
        </Button>
      );
    case 'active':
      return (
        <Button onClick={onManagePlan} disabled={busy !== null}>
          Manage subscription
        </Button>
      );
    case 'cancelling_in_grace':
      return (
        <Button onClick={onResume} loading={busy === 'resume'}>
          Resubscribe
        </Button>
      );
    case 'past_due':
      return (
        <Button onClick={onUpdatePayment} loading={busy === 'payment_method'}>
          Update payment
        </Button>
      );
    case 'comped':
      return null;
  }
}

/* ────────────────────────────────────────────────────────────── */

function CancelConfirmModal({
  open,
  onClose,
  onConfirm,
  busy,
  subscriptionEnd,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
  subscriptionEnd: string | null;
}) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Cancel subscription?"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" type="button" onClick={onClose} disabled={busy}>
            Keep subscription
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex h-9 cursor-pointer items-center justify-center rounded-control bg-danger px-4 text-body font-medium text-text-inverse transition-colors hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
          >
            {busy ? 'Cancelling…' : 'Yes, cancel'}
          </button>
        </div>
      }
    >
      <p className="text-body text-text">
        You&apos;ll keep access to Pro features
        {subscriptionEnd ? <> until <strong>{formatDate(subscriptionEnd)}</strong></> : ' until the end of your current billing period'},
        then drop to the free Starter plan.
      </p>
      <p className="mt-3 text-caption text-text-muted">
        You can resubscribe any time before then to undo the cancellation.
      </p>
    </Modal>
  );
}

/* ────────────────────────────────────────────────────────────── */

function StarterUsage({ onUpgrade, redirecting }: { onUpgrade: () => void; redirecting: boolean }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from('couples')
      .select('id', { count: 'exact', head: true })
      .then(({ count: c }) => {
        if (!cancelled) setCount(c ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (count === null) return null;
  const remaining = Math.max(0, 5 - count);
  const atCap = count >= 5;
  const pct = Math.min(100, (count / 5) * 100);

  return (
    <div className="mt-8">
      <h4 className="mb-3 text-caption font-medium uppercase tracking-wide text-text-muted">
        Usage
      </h4>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-4">
          <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-border">
            <div
              className={`h-full transition-all ${atCap ? 'bg-warning' : 'bg-text'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="shrink-0 whitespace-nowrap text-body text-text-muted">
            <span className="font-medium text-text">{count} of 5</span> couples
            {atCap ? null : remaining === 1 ? ' · 1 left' : null}
          </div>
        </div>
        {atCap ? (
          <Button size="sm" variant="secondary" onClick={onUpgrade} loading={redirecting}>
            Upgrade to add more
          </Button>
        ) : null}
      </div>
    </div>
  );
}

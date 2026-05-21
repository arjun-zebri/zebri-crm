/**
 * Current-plan surface — no outer border, document-style layout.
 *
 * Big confident header (plan name + price). Status indicator with a
 * coloured dot. "What's included" grid as supporting info. One
 * primary CTA + two text links (Compare plans · Cancel/Resubscribe).
 * Starter users see a prominent usage indicator.
 *
 * @module app/(dashboard)/settings/billing/current-plan-card
 */
'use client';

import { AlertCircle, ArrowRight, Check } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { createClient } from '@/lib/supabase/client';

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
  /** Opens the plan-comparison modal. */
  onCompare: () => void;
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
  const [redirecting, setRedirecting] = useState<'portal' | PlanId | null>(null);
  const state = classify(props);

  const planId: PlanId =
    state === 'starter' || state === 'expired'
      ? 'starter'
      : (props.subscriptionPlan as PlanId) ?? 'pro';
  const plan = planById(planId);

  async function openPortal() {
    setRedirecting('portal');
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.assign(data.url);
      else {
        toast('Billing portal unavailable. Try again or contact support.', 'error');
        setRedirecting(null);
      }
    } catch {
      toast('Could not connect to billing. Check your connection and try again.', 'error');
      setRedirecting(null);
    }
  }

  async function subscribe(planChoice: PlanId) {
    setRedirecting(planChoice);
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
        setRedirecting(null);
      }
    } catch {
      toast('Could not start checkout. Please try again.', 'error');
      setRedirecting(null);
    }
  }

  return (
    <div>
      {/* Header — plan name + price, big and confident */}
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
          Update your payment method in the billing portal to restore access.
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
      {state === 'starter' ? <StarterUsage onUpgrade={() => subscribe('pro')} redirecting={redirecting === 'pro'} /> : null}

      {/* Actions */}
      {state === 'comped' ? null : (
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <PrimaryAction
            state={state}
            redirecting={redirecting}
            onPortal={openPortal}
            onSubscribe={() => subscribe('pro')}
          />
          <button
            type="button"
            onClick={props.onCompare}
            className="inline-flex items-center gap-1 text-body text-text-muted hover:text-text"
          >
            Compare plans
            <ArrowRight size={14} strokeWidth={1.5} />
          </button>
          {state === 'active' || state === 'cancelling_in_grace' ? (
            <button
              type="button"
              onClick={openPortal}
              className="text-body text-text-muted hover:text-danger"
              disabled={redirecting !== null}
            >
              {state === 'cancelling_in_grace' ? 'Resubscribe' : 'Cancel subscription'}
            </button>
          ) : null}
        </div>
      )}
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

function PrimaryAction({
  state,
  redirecting,
  onPortal,
  onSubscribe,
}: {
  state: CardState;
  redirecting: 'portal' | PlanId | null;
  onPortal: () => void;
  onSubscribe: () => void;
}) {
  switch (state) {
    case 'starter':
    case 'expired':
      return (
        <Button onClick={onSubscribe} loading={redirecting === 'pro'}>
          Upgrade to Pro
        </Button>
      );
    case 'active':
    case 'past_due':
    case 'cancelling_in_grace':
      return (
        <Button onClick={onPortal} loading={redirecting === 'portal'}>
          {state === 'past_due' ? 'Update payment' : 'Manage subscription'}
        </Button>
      );
    case 'comped':
      return null;
  }
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

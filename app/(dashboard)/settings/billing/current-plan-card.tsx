/**
 * Current-plan card — integrated billing surface for the Plans &
 * Billing tab.
 *
 * One bordered surface holding: plan name + price + state badge +
 * inline "what's included" highlights + primary action ("Manage
 * subscription" → Stripe portal) + a quiet "Change plan" link that
 * expands the comparison table below + a tertiary "Cancel" link
 * (also via the Stripe portal).
 *
 * Starter users see "X of 5 couples used" inline so the cap is
 * visible before they hit it.
 *
 * Free trial removed — Starter (5-couple cap) is the only free
 * tier. CTA text for Starter / past-due / expired states reads
 * "Subscribe" / "Upgrade", never "Start free trial".
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
  /** Toggles the expandable plan-comparison panel below the card. */
  onToggleCompare: () => void;
  /** Whether the comparison panel is currently open (for the chevron). */
  compareOpen: boolean;
}

type CardState =
  | 'starter'
  | 'active'
  | 'cancelling_in_grace'
  | 'past_due'
  | 'expired'
  | 'comped';

/**
 * Classify the user into a render state. The 14-day trial is gone
 * — `trialing` is no longer written at signup, so we treat any
 * remaining `trialing` value as "active subscription" (admins
 * comping a user might still set it).
 */
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
  const highlights = PLAN_HIGHLIGHTS[planId];

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

  // ── Per-state copy ───────────────────────────────────────────────
  const statusLabel: { tone: 'success' | 'warning' | 'danger' | 'muted'; text: string } = (() => {
    switch (state) {
      case 'starter':
        return { tone: 'muted', text: 'Free' };
      case 'active':
        return {
          tone: 'success',
          text: props.subscriptionEnd
            ? `Renews ${formatDate(props.subscriptionEnd)}`
            : 'Active',
        };
      case 'cancelling_in_grace':
        return {
          tone: 'warning',
          text: props.subscriptionEnd
            ? `Cancels ${formatDate(props.subscriptionEnd)}`
            : 'Cancellation scheduled',
        };
      case 'past_due':
        return { tone: 'danger', text: 'Payment failed' };
      case 'expired':
        return { tone: 'muted', text: 'Subscription ended' };
      case 'comped':
        return { tone: 'success', text: 'Comped' };
    }
  })();

  const toneClass = {
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    muted: 'text-text-muted',
  }[statusLabel.tone];

  return (
    <section className="rounded-card border border-border bg-surface p-6 sm:p-8">
      {/* Header: plan name + price + state */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div className="flex items-baseline gap-3">
          <h2 className="text-section font-semibold text-text">{plan.name} plan</h2>
          <span className={`text-caption ${toneClass}`}>{statusLabel.text}</span>
        </div>
        <div className="text-body text-text-muted">
          {plan.price ? (
            <>
              <span className="text-text font-medium">{plan.price}</span>
              {plan.period}
            </>
          ) : (
            'Free'
          )}
        </div>
      </div>

      {/* Inline what's included */}
      <ul className="mt-5 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {highlights.map((h) => (
          <li key={h} className="flex items-start gap-2 text-body text-text">
            <Check size={14} strokeWidth={1.5} className="mt-0.5 shrink-0 text-text-muted" />
            {h}
          </li>
        ))}
      </ul>

      {/* Starter-specific usage indicator */}
      {state === 'starter' ? <StarterUsage /> : null}

      {/* Past-due banner — full-width tone-shaded notice */}
      {state === 'past_due' ? (
        <p className="mt-5 inline-flex items-center gap-2 rounded-control border border-danger/40 bg-danger/5 px-3 py-2 text-caption text-danger">
          <AlertCircle size={14} strokeWidth={1.5} />
          Update your payment method in the billing portal to restore access.
        </p>
      ) : null}

      {/* Comped — no actions row */}
      {state === 'comped' ? null : (
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <PrimaryAction
            state={state}
            redirecting={redirecting}
            onPortal={openPortal}
            onSubscribe={() => subscribe('pro')}
          />
          <button
            type="button"
            onClick={props.onToggleCompare}
            className="inline-flex items-center gap-1 text-body text-text-muted hover:text-text"
          >
            {props.compareOpen ? 'Hide comparison' : 'Compare plans'}
            <ArrowRight
              size={14}
              strokeWidth={1.5}
              className={`transition-transform ${props.compareOpen ? 'rotate-90' : ''}`}
            />
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
    </section>
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

function StarterUsage() {
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
  return (
    <div className="mt-5 flex items-center justify-between gap-3 rounded-control border border-border bg-surface-muted px-3 py-2">
      <div className="flex items-center gap-3">
        <CoupleMeter used={count} cap={5} />
        <span className="text-caption text-text-muted">
          <span className="font-medium text-text">{count} of 5</span> couples used
          {atCap ? ' — upgrade to add more' : remaining === 1 ? ' — 1 left' : null}
        </span>
      </div>
      {atCap ? <AlertCircle size={14} strokeWidth={1.5} className="shrink-0 text-warning" /> : null}
    </div>
  );
}

function CoupleMeter({ used, cap }: { used: number; cap: number }) {
  const pct = Math.min(100, (used / cap) * 100);
  const overCap = used >= cap;
  return (
    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-border">
      <div
        className={`h-full transition-all ${overCap ? 'bg-warning' : 'bg-text'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}


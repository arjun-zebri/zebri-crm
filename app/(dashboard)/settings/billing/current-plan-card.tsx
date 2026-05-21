/**
 * Current-plan card — the single "what state am I in?" view at the
 * top of the Plans & Billing tab.
 *
 * One card per state. No promotional CTAs, no badge ribbons; one
 * primary action ("Manage subscription" → Stripe portal) and a
 * quiet "Compare plans" link to expand the full tier matrix.
 *
 * @module app/(dashboard)/settings/billing/current-plan-card
 */
'use client';

import { AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

import { formatDate, planById, type PlanId } from './plans';

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

/**
 * Classify the user into one of seven render states. The trial-expired
 * case (trial_end < now while status === 'trialing') is treated as
 * "trial expired" so the card surfaces the right copy even before the
 * Stripe webhook flips the status.
 */
function classify(p: CurrentPlanCardProps):
  | 'never_trialled'
  | 'trialing'
  | 'trial_expired'
  | 'active'
  | 'cancelling_in_grace'
  | 'past_due'
  | 'expired'
  | 'comped' {
  if (p.isComped && p.status === 'active') return 'comped';
  if (p.status === 'past_due') return 'past_due';
  if (p.status === 'expired') return 'expired';
  if (p.status === 'active' && p.cancelAtPeriodEnd) return 'cancelling_in_grace';
  if (p.status === 'active') return 'active';
  if (p.status === 'trialing') {
    if (p.trialEnd && new Date(p.trialEnd).getTime() < Date.now()) return 'trial_expired';
    return 'trialing';
  }
  return 'never_trialled';
}

export function CurrentPlanCard(props: CurrentPlanCardProps) {
  const { toast } = useToast();
  const [redirecting, setRedirecting] = useState<'portal' | PlanId | null>(null);
  const state = classify(props);

  // Which plan to surface as the "current" name. For free-tier states
  // (never_trialled / expired) we show "Starter"; for everything else
  // we use the subscription_plan field (defaulting to Pro).
  const planId: PlanId =
    state === 'never_trialled' || state === 'expired'
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

  async function startTrial(planChoice: PlanId) {
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

  // ── Status note + primary action per state ────────────────────────
  let statusNote: { tone: 'neutral' | 'warning' | 'danger'; text: string } | null = null;
  let primary: { label: string; onClick: () => void; busy: boolean } | null = null;

  switch (state) {
    case 'never_trialled':
      statusNote = { tone: 'neutral', text: 'Start a 14-day free trial of Pro — no credit card required.' };
      primary = {
        label: 'Start free trial',
        onClick: () => startTrial('pro'),
        busy: redirecting === 'pro',
      };
      break;
    case 'trialing':
      statusNote = {
        tone: 'neutral',
        text: props.trialEnd ? `Free trial — ends ${formatDate(props.trialEnd)}.` : 'Free trial.',
      };
      primary = {
        label: 'Manage subscription',
        onClick: openPortal,
        busy: redirecting === 'portal',
      };
      break;
    case 'trial_expired':
      statusNote = {
        tone: 'warning',
        text: 'Your free trial has ended. Subscribe to keep Pro features.',
      };
      primary = {
        label: 'Manage subscription',
        onClick: openPortal,
        busy: redirecting === 'portal',
      };
      break;
    case 'active':
      statusNote = { tone: 'neutral', text: 'Active subscription.' };
      primary = {
        label: 'Manage subscription',
        onClick: openPortal,
        busy: redirecting === 'portal',
      };
      break;
    case 'cancelling_in_grace':
      statusNote = {
        tone: 'warning',
        text: props.subscriptionEnd
          ? `Cancellation scheduled — access ends ${formatDate(props.subscriptionEnd)}.`
          : 'Cancellation scheduled.',
      };
      primary = {
        label: 'Resubscribe',
        onClick: openPortal,
        busy: redirecting === 'portal',
      };
      break;
    case 'past_due':
      statusNote = {
        tone: 'danger',
        text: 'Payment failed. Update your payment method to keep access.',
      };
      primary = {
        label: 'Update payment',
        onClick: openPortal,
        busy: redirecting === 'portal',
      };
      break;
    case 'expired':
      statusNote = {
        tone: 'neutral',
        text: 'Your previous subscription has ended. You can subscribe again any time.',
      };
      primary = {
        label: 'Subscribe',
        onClick: () => startTrial('pro'),
        busy: redirecting === 'pro',
      };
      break;
    case 'comped':
      statusNote = { tone: 'neutral', text: 'Comped account — no charges.' };
      // No primary CTA for comped users.
      break;
  }

  const ToneIcon =
    statusNote?.tone === 'danger'
      ? AlertCircle
      : statusNote?.tone === 'warning'
        ? AlertCircle
        : CheckCircle2;
  const toneClass =
    statusNote?.tone === 'danger'
      ? 'text-danger'
      : statusNote?.tone === 'warning'
        ? 'text-warning'
        : 'text-text-muted';

  return (
    <section className="rounded-card border border-border bg-surface p-6 sm:p-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-section font-semibold text-text">{plan.name}</h2>
        {plan.price ? (
          <div className="text-body text-text-muted">
            <span className="text-text font-medium">{plan.price}</span>
            {plan.period}
          </div>
        ) : (
          <div className="text-body text-text-muted">Free</div>
        )}
      </div>

      <p className="mt-1 text-body text-text-muted">{plan.tagline}</p>

      {statusNote ? (
        <p className={`mt-4 inline-flex items-center gap-2 text-body ${toneClass}`}>
          <ToneIcon size={14} strokeWidth={1.5} />
          {statusNote.text}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        {primary ? (
          <Button onClick={primary.onClick} loading={primary.busy}>
            {primary.label}
          </Button>
        ) : null}
        <button
          type="button"
          onClick={props.onToggleCompare}
          className="inline-flex items-center gap-1 text-body text-text-muted hover:text-text"
        >
          {props.compareOpen ? 'Hide plan comparison' : 'Compare plans'}
          <ArrowRight
            size={14}
            strokeWidth={1.5}
            className={`transition-transform ${props.compareOpen ? 'rotate-90' : ''}`}
          />
        </button>
      </div>
    </section>
  );
}

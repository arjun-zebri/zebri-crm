'use client';

import { FcGoogle } from 'react-icons/fc';
import { SiApple } from 'react-icons/si';

import { Button } from '@/components/ui-v2/button';
import { CardField, type CardValue } from '@/components/ui-v2/card-field';

import { money } from '../payments/payments-data';

import { REMIND_DAYS_BEFORE, TRIAL_DAYS, dayFromNow } from './plan-pricing';

/**
 * The plan sheet's right side, the payment, as a checkout summary: what
 * is due today ($0, big, with the plan beside it), then the trial as
 * three dated steps (today, the reminder two days before, the first
 * charge), the timeline the best trials show so nobody fears forgetting
 * to cancel; then Apple Pay and Google Pay, then the card as one field,
 * one Start free week button, and the fine print with the charge date.
 *
 * The wallet buttons are each brand's mark and the word "Pay", not the
 * Apple Pay logo artwork, which carries its own outline and read as a
 * box inside the button. Demo: nothing is charged.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/plan-payment
 */

export interface PlanPaymentProps {
  /** The plan's name and its monthly price after the trial. */
  plan: string;
  monthly: number;
  card: CardValue;
  onCard: (c: CardValue) => void;
  error?: string | undefined;
  busy: boolean;
  onStart: (via: 'card' | 'wallet') => void;
}

/** The payment side. See {@link PlanPaymentProps}. */
export function PlanPayment({ plan, monthly, card, onCard, error, busy, onStart }: PlanPaymentProps) {
  const charged = dayFromNow(TRIAL_DAYS);
  const steps: [string, string, string, boolean][] = [
    ['Today', `Full access to ${plan}, free`, dayFromNow(0), true],
    ['Reminder email', 'Two days before your trial ends', dayFromNow(TRIAL_DAYS - REMIND_DAYS_BEFORE), false],
    ['First charge', `${money(monthly)} a month`, charged, false],
  ];
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="type-body text-zebra-500">Due today</p>
          <p className="type-display text-zebra-950">{money(0)}</p>
        </div>
        <p className="pb-1 type-body text-zebra-500">{plan}, monthly</p>
      </div>
      <ol aria-label="How your free week works" className="relative space-y-5">
        {/* The thread the three days hang on. */}
        <span aria-hidden="true" className="absolute bottom-3 left-[5px] top-3 w-px bg-hairline" />
        {steps.map(([title, detail, date, now]) => (
          <li key={title} className="relative flex items-start gap-4">
            <span aria-hidden="true" className={`mt-1.5 size-[11px] shrink-0 rounded-pill ${now ? 'bg-selected' : 'bg-zebra-300'}`} />
            <span className="min-w-0 flex-1">
              <span className="block type-label text-zebra-950">{title}</span>
              <span className="block type-body text-zebra-500">{detail}</span>
            </span>
            <span className="type-body text-zebra-500">{date}</span>
          </li>
        ))}
      </ol>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="wallet" disabled={busy} onClick={() => onStart('wallet')} icon={<SiApple aria-hidden="true" className="size-4" />}>
            Pay
          </Button>
          {/* Google's own four-colour G, as its brand rules ask on a white button. */}
          <Button variant="secondary" disabled={busy} onClick={() => onStart('wallet')} icon={<FcGoogle aria-hidden="true" className="size-4" />}>
            Pay
          </Button>
        </div>
        <p className="text-center type-body text-zebra-500">or pay by card</p>
        <CardField label="Card" value={card} onChange={onCard} error={error} />
      </div>
      <div className="space-y-3">
        <Button loading={busy} onClick={() => onStart('card')} className="w-full">
          Start free week
        </Button>
        <p className="text-center type-body text-zebra-500">
          You won&apos;t be charged until {charged}. Cancel any time in Settings. Secured by Stripe.
        </p>
      </div>
    </div>
  );
}

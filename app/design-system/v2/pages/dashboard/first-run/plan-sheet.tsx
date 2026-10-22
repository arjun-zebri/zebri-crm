'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { cardProblem, type CardValue } from '@/components/ui-v2/card-field';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogHeader } from '@/components/ui-v2/dialog-parts';
import { CloseIcon, SparklesIcon } from '@/components/ui-v2/icons';

import type { Role, Tier } from '../blocks/catalog';

import { PlanPayment } from './plan-payment';
import { PlanPicker } from './plan-picker';
import { offerOf } from './plan-pricing';

/**
 * The plan and card, asked from Home's "Start your free week" or at the
 * first real client (the highest-intent moment: the MC has just watched
 * a test client pay). Built as Stripe Checkout and Superhuman's upgrade
 * sheet are, a split: the value on the left (Pro and Max with who each
 * is for, whole-dollar prices beside the usual price struck and what it
 * goes back to after a year, what the picked plan includes with an icon
 * a line), the payment on the right on a neutral tint (due today $0, the
 * trial's three dated steps, Apple Pay and Google Pay, the card as one
 * field, Start free week, the fine print). Monthly only. The tint is the
 * `hover` ink wash (zebra-50's cream beside two olive greens read as off;
 * it was an arbitrary 2.5% ink until the 2026-10-14 token ruling). No
 * header or footer bars: `DialogHeader` (quiet title, its Close placed on
 * the sheet's corner instead, over the tint) opens the value side.
 *
 * Replaced a single-column form (a header bar, two vague plan cards with
 * $47.20-style prices, three boxed card fields with a lock icon, and a
 * grey sentence of reassurance) that read as a generic checkout. Demo:
 * the card is checked for shape only and nothing is charged; the live
 * sheet uses Stripe Elements and real wallets.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/plan-sheet
 */

export interface PlanSheetProps {
  /** Who is waiting on it ("Priya & Dev"), "" when opened from Home; the sheet is open while set. */
  who: string | null;
  /** Preselected: Max when a Max block was added, else Pro. */
  initial: Tier;
  /** The account's trade, for who each plan is for. */
  role?: Role | undefined;
  onStart: (plan: Tier) => void;
  onClose: () => void;
}

/** The plan sheet. See {@link PlanSheetProps}. */
export function PlanSheet({ who, initial, role, onStart, onClose }: PlanSheetProps) {
  const [plan, setPlan] = useState<Tier>(initial);
  const [card, setCard] = useState<CardValue>({ number: '', expiry: '', cvc: '' });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const offer = offerOf(plan);

  function start(via: 'card' | 'wallet') {
    const problem = via === 'card' ? cardProblem(card) : undefined;
    setError(problem);
    if (problem) return;
    setBusy(true);
    window.setTimeout(() => onStart(plan), 1100);
  }

  return (
    <Dialog
      open={who !== null}
      onClose={busy ? () => {} : onClose}
      size="lg"
      aria-labelledby="plan-sheet-title"
    >
      <div className="relative h-full">
        {/* On the sheet, not a column: stacked on a phone, it stays top right.
            Placed by a wrapper, since the Button is itself \`relative\`. */}
        <span className="absolute right-3 top-3 z-10">
          <Button variant="ghost" square aria-label="Close" onClick={onClose} disabled={busy}>
            <CloseIcon aria-hidden="true" className="size-4" />
          </Button>
        </span>
        <div className="grid h-full grid-cols-1 overflow-y-auto md:grid-cols-[1fr_28rem] md:overflow-hidden">
          <section className="md:overflow-y-auto">
            <DialogHeader id="plan-sheet-title" icon={SparklesIcon} title="Start your free week" closable={false} />
            <div className="space-y-6 p-6 sm:p-10 sm:pt-6">
              {/* Why it is open: the client waiting on it, or the trial itself when asked for from Home. */}
              <p className="type-lead text-zebra-500">
                {who ? `To add ${who}, pick a plan. ` : ''}Try everything free for 7 days. After that, get 20% off your
                first 12 months.
              </p>
              <PlanPicker plan={plan} onPlan={setPlan} role={role} />
            </div>
          </section>
          {/* The payment on a quiet tint: a split, as Stripe Checkout lays it out, not a box in the sheet. */}
          <section aria-label="Payment" className="bg-hover p-6 sm:p-10 md:overflow-y-auto">
            <PlanPayment
              plan={offer.name}
              monthly={offer.monthly}
              card={card}
              onCard={(c) => {
                setCard(c);
                setError(undefined);
              }}
              error={error}
              busy={busy}
              onStart={start}
            />
          </section>
        </div>
      </div>
    </Dialog>
  );
}

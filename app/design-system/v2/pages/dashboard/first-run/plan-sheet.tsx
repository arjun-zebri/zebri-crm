'use client';

import { Check, Lock } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { ChoiceCard } from '@/components/ui-v2/choice-card';
import { Dialog } from '@/components/ui-v2/dialog';
import { Input } from '@/components/ui-v2/input';

import { PLANS } from '../../onboarding/demo-data';
import type { Tier } from '../blocks/catalog';
import { DialogBody, DialogFooter, DialogHeader } from '../home/dialog-parts';

/**
 * The plan and card, asked at the first real client: the highest-intent
 * moment in the whole flow (the MC has just watched a test client pay
 * and is now typing a real person's name), and before the moment Zebri
 * becomes part of their business. The test client never asks.
 *
 * Pro and Max side by side with the one-time 20% off, then the card, then
 * exactly what happens and when: nothing today, the first charge date and
 * amount on the line above the button. Demo: the card is checked for
 * shape only and nothing is charged; the live page uses Stripe Elements
 * (with Apple Pay and Link) in place of the three fields.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/plan-sheet
 */

export interface PlanSheetProps {
  /** Who is waiting on it ("Priya & Dev"); the sheet is open while set. */
  who: string | null;
  /** Preselected: Max when a Max block was added, else Pro. */
  initial: Tier;
  onStart: (plan: Tier) => void;
  onClose: () => void;
}

const OFFER = 0.2;
const TRIAL_DAYS = 7;
const offer = (price: number) => Math.round(price * (1 - OFFER) * 100) / 100;
const cents = (n: number) => `$${n.toFixed(2).replace(/\.00$/, '')}`;
const firstCharge = () =>
  new Date(Date.now() + TRIAL_DAYS * 86_400_000).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
const digits = (s: string) => s.replace(/\D/g, '');

/** The plan sheet. See {@link PlanSheetProps}. */
export function PlanSheet({ who, initial, onStart, onClose }: PlanSheetProps) {
  const [plan, setPlan] = useState<Tier>(initial);
  const [card, setCard] = useState({ number: '', expiry: '', cvc: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof card, string | undefined>>>({});
  const [busy, setBusy] = useState(false);
  const price = PLANS.find((p) => p.id === plan)?.price ?? 0;

  function start() {
    const next = {
      number: digits(card.number).length >= 12 ? undefined : 'Check the card number.',
      expiry: /^\d{2}\s*\/\s*\d{2}$/.test(card.expiry.trim()) ? undefined : 'MM / YY',
      cvc: /^\d{3,4}$/.test(card.cvc.trim()) ? undefined : '3 or 4 digits',
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setBusy(true);
    window.setTimeout(() => onStart(plan), 1100);
  }

  return (
    <Dialog open={who !== null} onClose={busy ? () => {} : onClose} size="form" aria-labelledby="plan-sheet-title">
      <DialogHeader id="plan-sheet-title" title="Start your free week" note={who ? `To add ${who}` : undefined} />
      <DialogBody>
        <div className="space-y-5">
          <p className="type-body text-zebra-500">
            Your first week is free, then 20% off for your first 12 months.
          </p>
          <div role="radiogroup" aria-label="Plan" className="grid gap-3 sm:grid-cols-2">
            {PLANS.filter((p) => p.id !== 'enterprise').map((p) => (
              <ChoiceCard key={p.id} selected={plan === p.id} onClick={() => setPlan(p.id as Tier)} className="space-y-1 p-4">
                <span className="flex items-center gap-2 type-label">
                  {p.name}
                  {'popular' in p ? <Badge tone="brand">Popular</Badge> : null}
                </span>
                <span className="block">
                  <span className="type-heading">{cents(offer(p.price ?? 0))}</span>
                  <span className="type-body text-zebra-500"> / month</span>
                </span>
                <span className="block type-body text-zebra-500">
                  {p.pitch}. Normally <span className="line-through">${p.price}</span>
                </span>
              </ChoiceCard>
            ))}
          </div>
          <div className="space-y-3">
            <Input
              label="Card number"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="1234 1234 1234 1234"
              leading={<Lock strokeWidth={1.5} className="size-4" />}
              value={card.number}
              onChange={(e) => setCard({ ...card, number: e.target.value })}
              error={errors.number}
              data-autofocus
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Expiry"
                autoComplete="cc-exp"
                placeholder="MM / YY"
                value={card.expiry}
                onChange={(e) => setCard({ ...card, expiry: e.target.value })}
                error={errors.expiry}
              />
              <Input
                label="CVC"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="123"
                value={card.cvc}
                onChange={(e) => setCard({ ...card, cvc: e.target.value })}
                error={errors.cvc}
              />
            </div>
          </div>
          <p className="flex gap-2 type-body text-zebra-500">
            <Check aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-4 shrink-0 text-grass-700" />
            Nothing today. First charge {firstCharge()}, {cents(offer(price))}, then monthly. Cancel any time in
            Settings. Secured by Stripe.
          </p>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="plain" onClick={onClose} disabled={busy}>
          Not now
        </Button>
        <Button loading={busy} onClick={start}>
          Start my free week
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

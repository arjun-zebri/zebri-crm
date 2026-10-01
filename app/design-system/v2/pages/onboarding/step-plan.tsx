import { Check, Gift } from 'lucide-react';

import { Badge } from '@/components/ui-v2/badge';
import { ChoiceCard } from '@/components/ui-v2/choice-card';
import { Panel } from '@/components/ui-v2/panel';

import { PLANS, type PlanId } from './demo-data';

/**
 * Step 7, Choose your plan: the one-time offer first, on the highlight
 * panel so it is seen without shouting; then Pro, Max and Enterprise as
 * pick-one cards, Pro and Max with the offer price shown against the
 * full one; then the fine print.
 *
 * @module app/design-system/v2/pages/onboarding/step-plan
 */

/** The one-time discount on Pro and Max, as a fraction off. */
const OFFER = 0.2;

/** A price after the offer, to the cent, without trailing zeros. */
const offerPrice = (price: number) => {
  const n = Math.round(price * (1 - OFFER) * 100) / 100;
  return n % 1 ? n.toFixed(2) : String(n);
};

/** "A", "A and B", "A, B and C". */
const listOf = (names: string[]) =>
  names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

/**
 * The plan step. The flow owns the pick; this only shows and changes it.
 * `maxBlocks` names the Max blocks added on the step before, so the MC
 * can see why Max came preselected.
 */
export function StepPlan({
  plan,
  onPlan,
  maxBlocks = [],
}: {
  plan: PlanId;
  onPlan: (p: PlanId) => void;
  maxBlocks?: string[];
}) {
  return (
    <div className="max-w-4xl space-y-6">
      <Panel tone="highlight" className="flex items-center gap-4 p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-grass-100 text-grass-800">
          <Gift aria-hidden="true" strokeWidth={1.5} className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block type-heading">20% off Pro or Max for your first 12 months</span>
          <span className="block type-body text-zebra-500">A one-time offer. Only here, only now.</span>
        </span>
      </Panel>
      {maxBlocks.length ? (
        <p className="type-body text-zebra-500">
          {listOf(maxBlocks)} {maxBlocks.length === 1 ? 'is' : 'are'} on Max, so we picked it for you. Pro works too, without{' '}
          {maxBlocks.length === 1 ? 'it' : 'them'}.
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-3">
        {PLANS.map((p) => (
          <ChoiceCard key={p.id} selected={p.id === plan} onClick={() => onPlan(p.id)} className="space-y-4 p-5">
            <span className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 type-subheading">
                {p.name}
                {'popular' in p ? <Badge tone="brand">Popular</Badge> : null}
              </span>
              <span
                aria-hidden="true"
                className={`flex size-5 items-center justify-center rounded-pill border ${
                  p.id === plan ? 'border-grass-800 bg-grass-800 text-zebra-50' : 'border-zebra-300'
                }`}
              >
                {p.id === plan ? <Check strokeWidth={1.5} className="size-3" /> : null}
              </span>
            </span>
            <span className="block type-body text-zebra-500">{p.pitch}</span>
            <span className="block">
              {p.price === null ? (
                <span className="type-title">Let&rsquo;s talk</span>
              ) : (
                <>
                  <span className="type-title">${offerPrice(p.price)}</span>
                  <span className="type-body text-zebra-500"> / month</span>
                  <span className="block type-body text-zebra-400">
                    Normally <span className="line-through">${p.price}</span>
                  </span>
                </>
              )}
            </span>
            <span className="block space-y-1.5 border-t border-zebra-200 pt-4">
              {p.highlights.map((h) => (
                <span key={h} className="flex gap-2 type-body text-zebra-700">
                  <Check aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-4 shrink-0 text-grass-700" />
                  {h}
                </span>
              ))}
            </span>
          </ChoiceCard>
        ))}
      </div>
      <p className="type-body text-zebra-500">
        Nothing is charged until the trial ends, and you can cancel any time from Settings. Prices in AUD, including GST.
        Secured by Stripe.
      </p>
    </div>
  );
}

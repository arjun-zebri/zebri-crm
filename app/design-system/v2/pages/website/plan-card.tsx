'use client';

import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { CheckIcon } from '@/components/ui-v2/icons';

import { EARLY_ACCESS_ID, JumpButton } from './jump-button';

/**
 * One pricing card: plan and price on top, the plan's list under a
 * hairline, the button at the foot (`site-pricing.tsx` lays out three).
 * A client component for Enterprise's button, which opens an email from
 * a click handler; the plan buttons carry their plan to the waitlist.
 *
 * @module app/design-system/v2/pages/website/plan-card
 */

/** One plan, as the card shows it. */
export interface CardProps {
  name: string;
  forWho: string;
  price: string;
  was?: string;
  per: string;
  /** The plan it builds on, said once above the list ("Everything in Pro, plus:"), never as a row. */
  plus?: string;
  features: string[];
  cta: string;
  /** The plan carried to the waitlist form; none for Enterprise, which emails instead. */
  plan?: string;
  recommended?: boolean;
}

/** Enterprise's way in: a person, not the waitlist. */
const TALK_TO_US = 'mailto:arjun@zebri.com.au?subject=Zebri%20Enterprise';

/** One plan card. See {@link CardProps}. */
export function PlanCard({
  name,
  forWho,
  price,
  was,
  per,
  plus,
  features,
  cta,
  plan,
  recommended = false,
}: CardProps) {
  return (
    <div className="flex h-full flex-col rounded-panel bg-field p-6 shadow-lg ring-1 ring-zebra-950/10">
      <div className="flex items-center gap-2">
        <h3 className="type-heading text-zebra-950">{name}</h3>
        {recommended ? <Badge tone="brand">Recommended</Badge> : null}
      </div>
      {/* Two lines held for who it is for, so the prices line up across the row (side by side only). */}
      <p className="mt-1 type-body md:min-h-10 text-zebra-500">{forWho}</p>
      <p className="mt-4 flex items-baseline gap-2">
        <span className="type-site-title text-zebra-950">{price}</span>
        {was ? <s className="type-site-lead text-zebra-400">{was}</s> : null}
      </p>
      <p className="mt-1 type-body md:min-h-5 text-zebra-500">{per}</p>
      {/* The inclusions straight on the card, a hairline above them, no tinted well (founder, 2026-10-19).
          They take the spare height, so every button sits at its card's foot, level across the row. */}
      <div className="mt-5 flex-1 border-t border-hairline pt-5">
        {plus ? (
          <p className="mb-2.5 type-label text-zebra-950">Everything in {plus}, plus:</p>
        ) : null}
        <ul className="space-y-2.5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 type-body text-zebra-700">
              <CheckIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-grass-700" />
              {f}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-6 grid">
        {plan ? (
          <JumpButton to={EARLY_ACCESS_ID} plan={plan} variant={recommended ? 'primary' : 'secondary'}>
            {cta}
          </JumpButton>
        ) : (
          <Button variant="secondary" onClick={() => window.location.assign(TALK_TO_US)}>
            {cta}
          </Button>
        )}
      </div>
    </div>
  );
}

'use client';

import { Badge } from '@/components/ui-v2/badge';
import { ChoiceCard } from '@/components/ui-v2/choice-card';
import { GroupLabel } from '@/components/ui-v2/group-label';
import { IconCircle } from '@/components/ui-v2/icon-circle';

import type { Role, Tier } from '../blocks/catalog';

import { OFFERS, forRole, offerOf, onOffer } from './plan-pricing';

/**
 * The plan sheet's left side, the value: Pro and Max as two rows (a
 * radio mark, the name and who it is for, then the offer with the usual
 * price struck and, under it, what it goes back to after a year, said
 * plainly), then what the picked plan includes, each line led by its
 * own icon. One plan's features at a time, so the difference is read,
 * not hunted for.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/plan-picker
 */

export interface PlanPickerProps {
  plan: Tier;
  onPlan: (t: Tier) => void;
  /** The account's trade, so who each plan is for is said in it. */
  role?: Role | undefined;
}

/** The picker. See {@link PlanPickerProps}. */
export function PlanPicker({ plan, onPlan, role }: PlanPickerProps) {
  const picked = offerOf(plan);
  return (
    <div className="space-y-8">
      <div role="group" aria-label="Plan" className="space-y-3">
        {OFFERS.map((o) => {
          const on = plan === o.tier;
          return (
            <ChoiceCard key={o.tier} selected={on} onClick={() => onPlan(o.tier)}>
              <span className="flex w-full items-center gap-4">
                {/* A radio mark, so one-of-two reads at a glance and not only from the border. */}
                <span
                  aria-hidden="true"
                  className={`flex size-5 shrink-0 items-center justify-center rounded-pill border transition-colors duration-150 motion-reduce:transition-none ${on ? 'border-selected bg-selected' : 'border-zebra-300 bg-field'}`}
                >
                  {on ? <span className="size-2 rounded-pill bg-zebra-50" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 type-subheading text-zebra-950">
                    {o.name}
                    {o.popular ? <Badge tone="brand">Recommended</Badge> : null}
                  </span>
                  <span className="block type-body text-zebra-500">{forRole(o, role)}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block">
                    {onOffer(o) ? (
                      <>
                        <span className="type-body text-zebra-400 line-through">${o.was}</span>{' '}
                      </>
                    ) : null}
                    <span className="type-title text-zebra-950">${o.monthly}</span>
                    <span className="type-body text-zebra-500"> /mo</span>
                  </span>
                  {onOffer(o) ? (
                    <span className="block type-body text-zebra-500">then ${o.was}/mo after a year</span>
                  ) : null}
                </span>
              </span>
            </ChoiceCard>
          );
        })}
      </div>
      <div className="space-y-3">
        <GroupLabel>What&apos;s in {picked.name}</GroupLabel>
        <ul className="space-y-3">
          {picked.features.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 type-body text-zebra-950">
              <IconCircle icon={Icon} />
              {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

'use client';


import { Button } from '@/components/ui-v2/button';
import { ROW } from '@/components/ui-v2/control-styles';
import { EmptyState } from '@/components/ui-v2/empty-state';
import { GroupLabel } from '@/components/ui-v2/group-label';
import { IconCircle } from '@/components/ui-v2/icon-circle';
import { CloseIcon, NotificationsIcon, UserIcon } from '@/components/ui-v2/icons';

import { AddFollowUp } from './add-follow-up';
import type { JourneyStep, StepKind } from './journeys-data';
import { timingOf } from './timing';

/**
 * The step panel's Follow-ups section: its group label with Add
 * (`AddFollowUp`: which kind, then how long), then each follow-up as a
 * line: a bell for Remind (Zebri emails the client) or a person for Tell
 * me (the MC gets a heads-up to chase it), what it is ("Remind after 3
 * days"), and under it when it stops ("If they haven't replied"), with
 * its remove on the right. A Remind line opens its email on the page
 * beside the panel (`onPick`), where Edit email rewrites it.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/step-follow-ups
 */

/** When each kind's follow-ups stop. */
const UNTIL: Partial<Record<StepKind, string>> = {
  email: "If they haven't replied",
  proposal: "If they haven't accepted",
  contract: "If they haven't signed",
  invoice: "If it isn't paid",
  questionnaire: "If they haven't finished it",
  runSheet: "If they haven't approved it",
};

/** When a step's follow-ups stop. A thank you after the event waits on a review, not an answer. */
function untilOf(step: JourneyStep) {
  const t = timingOf(step);
  if (step.kind === 'email' && t.at === 'wedding' && t.side === 'after') return "Until they leave a review or reply";
  return UNTIL[step.kind];
}

/** A Remind follow-up (one that emails the client), as opposed to a Tell me. */
export const isRemind = (item: string) => !/^Tell/.test(item);

/**
 * A saved follow-up as its line reads: "Remind after 3 days". Older
 * journeys spelled the condition out on each one ("Reminder after 3 days
 * if not signed"); it is the line under it now, so it is dropped here.
 */
export const labelOf = (item: string) =>
  item
    .replace(/\s+if\s.+$/, '')
    .replace(/^(Reminder|Remind them) /, 'Remind ')
    .replace(/^Tell you /, 'Tell me ');

export interface StepFollowUpsProps {
  step: JourneyStep;
  onChange: (step: JourneyStep) => void;
  /** Shows a Remind follow-up's email on the page. */
  onPick: (item: string) => void;
}

/** The section. See {@link StepFollowUpsProps}. */
export function StepFollowUps({ step, onChange, onPick }: StepFollowUpsProps) {
  const items = step.reminders;
  const set = (reminders: string[]) => onChange({ ...step, reminders });
  return (
    <section aria-labelledby="follow-ups" className="space-y-2">
      <div className="flex items-center justify-between">
        <GroupLabel as="h3" id="follow-ups">
          Follow-ups
        </GroupLabel>
        <AddFollowUp onAdd={(item) => (items.some((x) => labelOf(x) === labelOf(item)) ? undefined : set([...items, item]))} />
      </div>
      {items.length ? (
        <ul className="-mx-2 space-y-1">
          {items.map((item) => {
            const Icon = isRemind(item) ? NotificationsIcon : UserIcon;
            const words = (
              <>
                <IconCircle icon={Icon} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-zebra-950">{labelOf(item)}</span>
                  <span className="block truncate text-zebra-500">{untilOf(step)}</span>
                </span>
              </>
            );
            return (
              <li key={item} className="flex items-center gap-1">
                {isRemind(item) ? (
                  <button type="button" onClick={() => onPick(item)} className={`flex min-w-0 flex-1 items-center gap-3 rounded-button p-2 text-left ${ROW}`}>
                    {words}
                  </button>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-3 p-2">{words}</div>
                )}
                <Button variant="ghost" square aria-label={`Remove ${labelOf(item)}`} onClick={() => set(items.filter((x) => x !== item))}>
                  <CloseIcon aria-hidden="true" className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState compact title="No follow-ups" body="Add one to remind them, or to get a heads-up yourself." />
      )}
    </section>
  );
}

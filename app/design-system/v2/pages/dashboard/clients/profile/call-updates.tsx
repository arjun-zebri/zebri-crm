'use client';


import { Button } from '@/components/ui-v2/button';
import { GroupLabel } from '@/components/ui-v2/group-label';
import { CheckIcon, CloseIcon } from '@/components/ui-v2/icons';

import type { CallUpdate, Verdict } from './calls-data';
import { factIcon } from './overview-rows';

/**
 * The changes Zebri heard on a call, as the Overview's own rows: the
 * detail's icon and name, the old value struck through before the new
 * one, then a quiet dismiss and apply (2026-10-09 founder mockup). Apply
 * all is the one primary while more than one is open. Nothing touches
 * the record until applied; an applied change can be undone while the
 * notes are open.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/call-updates
 */

export interface CallUpdatesProps {
  updates: CallUpdate[];
  decisions: Record<string, Verdict>;
  onDecide: (id: string, v: Verdict | null) => void;
  /** Show the words each update was heard in, under its value: the proof, where there is no transcript beside it. */
  quotes?: boolean | undefined;
}

/** The updates list. See {@link CallUpdatesProps}. */
export function CallUpdates({ updates, decisions, onDecide, quotes = false }: CallUpdatesProps) {
  const open = updates.filter((u) => !u.decided && !decisions[u.id]);
  return (
    <section aria-labelledby="call-updates" className="space-y-4">
      <div className="flex min-h-9 items-center gap-3">
        <GroupLabel as="h4" id="call-updates" className="mr-auto">
          {updates.length} {updates.length === 1 ? 'update' : 'updates'} from the call
        </GroupLabel>
        {open.length > 1 ? (
          <Button onClick={() => open.forEach((u) => onDecide(u.id, 'applied'))}>Apply all</Button>
        ) : null}
      </div>
      <ul>
        {updates.map((u) => {
          const verdict = u.decided ?? decisions[u.id];
          const Icon = factIcon({ label: u.label, value: u.to });
          return (
            // Phones: the detail's name and the decision on one line, the change across the width under
            // them; side by side from sm (a narrow middle column wrapped the change a word a line).
            <li
              key={u.id}
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-2 type-body sm:flex sm:min-h-12 ${quotes ? 'sm:py-1.5' : 'sm:py-0'}`}
            >
              <span className="flex shrink-0 items-center gap-3 text-zebra-500 sm:w-32 md:w-40">
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                {u.label}
              </span>
              <span
                // Wraps rather than truncating: on a phone the struck-out old value left the new one "Tom Mor…".
                className={`order-last col-span-2 min-w-0 flex-1 pl-7 text-pretty text-zebra-950 sm:order-none sm:pl-0 ${verdict === 'dismissed' ? 'opacity-40' : ''}`}
              >
                <span className="mr-2 text-zebra-400 line-through">{u.from || 'Not set'}</span>
                {u.to}
                {quotes ? <span className="block text-zebra-500">“{u.quote}”</span> : null}
              </span>
              <Decision
                verdict={verdict}
                fixed={Boolean(u.decided)}
                label={u.label}
                onDecide={(v) => onDecide(u.id, v)}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Dismiss and apply as two quiet icons, or what was decided with Undo. */
function Decision({
  verdict,
  fixed,
  label,
  onDecide,
}: {
  verdict: Verdict | undefined;
  fixed: boolean;
  label: string;
  onDecide: (v: Verdict | null) => void;
}) {
  if (verdict)
    return (
      <span className="flex shrink-0 items-center gap-3">
        <span className={verdict === 'applied' ? 'text-grass-700' : 'text-zebra-500'}>
          {verdict === 'applied' ? 'Applied' : 'Dismissed'}
        </span>
        {fixed ? null : (
          <Button variant="plain" onClick={() => onDecide(null)}>
            Undo
          </Button>
        )}
      </span>
    );
  return (
    // -mr-2 puts the tick's glyph on the column's right edge.
    <span className="-mr-2 flex shrink-0 items-center">
      <Button
        variant="ghost"
        square
        aria-label={`Dismiss the ${label.toLowerCase()} update`}
        onClick={() => onDecide('dismissed')}
      >
        <CloseIcon aria-hidden="true" className="size-4" />
      </Button>
      <Button
        variant="ghost"
        square
        aria-label={`Apply the ${label.toLowerCase()} update`}
        onClick={() => onDecide('applied')}
      >
        <CheckIcon aria-hidden="true" className="size-4" />
      </Button>
    </span>
  );
}

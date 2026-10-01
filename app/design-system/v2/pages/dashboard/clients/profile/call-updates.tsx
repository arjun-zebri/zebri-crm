'use client';

import { Check, TextQuote, X } from 'lucide-react';

import { Button } from '@/components/ui-v2/button';

import type { CallUpdate, Verdict } from './calls-data';

/**
 * The changes Zebri heard on a call, one line each: the field, the new
 * value (the old one struck through before it), and Apply. Dismiss is a
 * quiet X, and a quote icon jumps to where it was said in the transcript,
 * so the words behind a change are one click away without being printed.
 * Nothing touches the record until applied; an applied change can be
 * undone while the notes are open.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/call-updates
 */

export interface CallUpdatesProps {
  updates: CallUpdate[];
  decisions: Record<string, Verdict>;
  onDecide: (id: string, v: Verdict | null) => void;
  onJump: (line: string) => void;
}

/** The updates list. See {@link CallUpdatesProps}. */
export function CallUpdates({ updates, decisions, onDecide, onJump }: CallUpdatesProps) {
  const open = updates.filter((u) => !u.decided && !decisions[u.id]);
  return (
    <section aria-labelledby="call-updates" className="space-y-3">
      <div className="flex min-h-9 items-center gap-3">
        <h3 id="call-updates" className="mr-auto type-label font-semibold text-zebra-950">
          Updates
        </h3>
        {open.length > 1 ? (
          <Button variant="secondary" onClick={() => open.forEach((u) => onDecide(u.id, 'applied'))}>
            Apply all
          </Button>
        ) : null}
      </div>
      <ul>
        {updates.map((u) => {
          const verdict = u.decided ?? decisions[u.id];
          return (
            <li
              key={u.id}
              className={`flex min-h-12 items-center gap-4 type-body ${verdict === 'dismissed' ? 'opacity-40' : ''}`}
            >
              <span className="w-24 shrink-0 text-zebra-500">{u.label}</span>
              <span className="flex min-w-0 flex-1 items-center gap-1">
                <span className="min-w-0 truncate text-zebra-950">
                  {u.from ? <span className="mr-2 text-zebra-400 line-through">{u.from}</span> : null}
                  {u.to}
                </span>
                <Button
                  variant="ghost"
                  square
                  aria-label={`Show where ${u.label.toLowerCase()} was said`}
                  title="Show where it was said"
                  onClick={() => onJump(u.line)}
                  className="shrink-0 text-zebra-400"
                >
                  <TextQuote aria-hidden="true" strokeWidth={1.5} className="size-4" />
                </Button>
              </span>
              <Decision verdict={verdict} fixed={Boolean(u.decided)} onDecide={(v) => onDecide(u.id, v)} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Apply and dismiss, or what was decided with Undo. */
function Decision({ verdict, fixed, onDecide }: { verdict: Verdict | undefined; fixed: boolean; onDecide: (v: Verdict | null) => void }) {
  return (
    <span className="flex shrink-0 items-center justify-end gap-1">
      {verdict ? (
        <>
          <span className={`inline-flex items-center gap-1.5 ${verdict === 'applied' ? 'text-grass-700' : 'text-zebra-500'}`}>
            {verdict === 'applied' ? <Check aria-hidden="true" strokeWidth={1.5} className="size-4" /> : null}
            {verdict === 'applied' ? 'Applied' : 'Dismissed'}
          </span>
          {fixed ? null : (
            <Button variant="plain" className="ml-3" onClick={() => onDecide(null)}>
              Undo
            </Button>
          )}
        </>
      ) : (
        <>
          <Button variant="ghost" square aria-label="Dismiss" title="Dismiss" onClick={() => onDecide('dismissed')}>
            <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
          </Button>
          <Button variant="secondary" onClick={() => onDecide('applied')}>
            Apply
          </Button>
        </>
      )}
    </span>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';

import { SEED_QUEUE, type QueueItem } from './up-next-data';

/**
 * What the MC has done in Journeys' Up next this visit: sends OKed,
 * to-dos ticked, rows skipped or paused. A settled row says what
 * happened in place first, then folds into Done, so nothing leaves from
 * under the pointer the moment it is clicked. Demo only: nothing is
 * saved, a reload starts over.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/use-up-next
 */

const SEND_MS = 700;
/** How long a settled row stays in place before it folds into Done. */
const LINGER_MS = 1400;

/** Up next's queue and what changes it. */
export function useUpNext() {
  const [queue, setQueue] = useState<QueueItem[]>(SEED_QUEUE);
  const [sending, setSending] = useState<ReadonlySet<string>>(() => new Set());
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const settle = (id: string, outcome: string) => {
    setQueue((q) => q.map((i) => (i.id === id ? { ...i, outcome } : i)));
    later(
      () =>
        setQueue((q) =>
          q.map((i) =>
            i.id === id && i.outcome ? { ...i, section: 'done', when: 'Just now' } : i,
          ),
        ),
      LINGER_MS,
    );
  };

  return {
    queue,
    sending,
    /** Marks a row done, saying what happened. */
    settle,
    /** Unticks a to-do. */
    reopen: (id: string) =>
      setQueue((q) =>
        q.map((i) => (i.id === id ? { ...i, section: 'todo', outcome: undefined } : i)),
      ),
    /** Sends a held message as it stands in the review: a beat of spinner, then Sent. */
    send: (id: string, draft: { subject: string; body: string }) => {
      setSending((s) => new Set(s).add(id));
      later(() => {
        setQueue((q) => q.map((i) => (i.id === id ? { ...i, draft } : i)));
        settle(id, 'Sent by you');
        setSending((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }, SEND_MS);
    },
  };
}

/** What `useUpNext` returns. */
export type UpNextState = ReturnType<typeof useUpNext>;

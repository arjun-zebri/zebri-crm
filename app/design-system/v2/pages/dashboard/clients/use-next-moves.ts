'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Next-move state for the Clients page: which client's move is sending
 * and which are done. Shared by all three views so a move sent from the
 * board is done in the list too. Demo only: a move waits a beat instead
 * of sending anything.
 *
 * @module app/design-system/v2/pages/dashboard/clients/use-next-moves
 */

/** Long enough to see the spinner, short enough not to feel slow. */
const SEND_MS = 900;

/** What the views read and call. See {@link useNextMoves}. */
export interface NextMoves {
  /** The client whose move is sending, if any. */
  busy: string | null;
  done: ReadonlySet<string>;
  run: (id: string) => void;
  /** Marks a move done at once (sent from the client's profile, which shows its own spinner). */
  complete: (id: string) => void;
}

/** Next-move state. See {@link NextMoves}. */
export function useNextMoves(): NextMoves {
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<ReadonlySet<string>>(() => new Set());
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  return {
    busy,
    done,
    run(id) {
      setBusy(id);
      timers.current.push(
        window.setTimeout(() => {
          setDone((d) => new Set(d).add(id));
          setBusy(null);
        }, SEND_MS),
      );
    },
    complete: (id) => setDone((d) => new Set(d).add(id)),
  };
}

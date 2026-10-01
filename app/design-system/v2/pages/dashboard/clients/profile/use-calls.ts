'use client';

import { useEffect, useRef, useState } from 'react';

import type { Client } from '../clients-data';

import { applyCalls, callsFor, pendingUpdates, type Call, type Verdict } from './calls-data';
import type { Profile } from './profile-data';

/**
 * A client's calls for one visit to their profile: the list, the
 * checklist for the next call, the call in progress, and what the MC
 * decided about each suggested update. Ending a call adds it at the top
 * as "writing notes" and turns it ready a moment later; whatever was not
 * ticked on the checklist carries over to the next call.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/use-calls
 */

// Long enough to read "Zebri is writing the notes", short enough to wait on in a demo.
const NOTES_MS = 3000;

/** The call in progress. */
export interface LiveCall {
  /** The booked call it started from, if any. */
  from?: string | undefined;
  title: string;
  /** `Date.now()` when it started, for the clock. */
  startedAt: number;
  checked: string[];
  scratch: string;
}

/** What {@link useCalls} hands the profile. */
export interface CallsState {
  calls: Call[];
  checklist: string[];
  setChecklist: (items: string[]) => void;
  live: LiveCall | null;
  start: (from?: string) => void;
  /** Ticks or unticks a checklist item on the live call. */
  tick: (item: string) => void;
  jot: (scratch: string) => void;
  /** Ends the live call; returns the new call's id. */
  end: () => string | null;
  decisions: Record<string, Verdict>;
  decide: (id: string, v: Verdict | null) => void;
  /** The profile with applied updates folded in. */
  profile: Profile;
  pending: number;
}

/** The Calls state. See {@link CallsState}. */
export function useCalls(client: Client, base: Profile): CallsState {
  const [seed] = useState(() => callsFor(client));
  const [calls, setCalls] = useState(seed.calls);
  const [checklist, setChecklist] = useState(seed.checklist);
  const [live, setLive] = useState<LiveCall | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Verdict>>({});
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const start = (from?: string) => {
    const booked = calls.find((c) => c.id === from);
    setLive({ from, title: booked?.title ?? 'Call', startedAt: Date.now(), checked: [], scratch: '' });
  };
  const tick = (item: string) =>
    setLive((l) =>
      l ? { ...l, checked: l.checked.includes(item) ? l.checked.filter((i) => i !== item) : [...l.checked, item] } : l,
    );
  const jot = (scratch: string) => setLive((l) => (l ? { ...l, scratch } : l));
  const end = () => {
    if (!live) return null;
    const id = `call-${live.startedAt}`;
    const missed = checklist.filter((i) => !live.checked.includes(i));
    const call: Call = {
      id,
      title: live.title,
      when: 'Today',
      length: seed.nextLength,
      status: 'processing',
      fresh: true,
      notes: {
        ...seed.next,
        // Ids must be unique per call, or deciding one would decide a later call's too.
        updates: seed.next.updates.map((u) => ({ ...u, id: `${id}:${u.id}` })),
        covered: checklist.filter((i) => live.checked.includes(i)),
        missed,
        scratch: live.scratch.trim() || undefined,
      },
    };
    setCalls((all) => [call, ...all.filter((c) => c.id !== live.from)]);
    // What the call did not get to is what the next one should.
    setChecklist(missed);
    setLive(null);
    timers.current.push(
      window.setTimeout(
        () => setCalls((all) => all.map((c) => (c.id === id ? { ...c, status: 'ready' } : c))),
        NOTES_MS,
      ),
    );
    return id;
  };
  const decide = (id: string, v: Verdict | null) =>
    setDecisions((d) => {
      const next = { ...d };
      if (v) next[id] = v;
      else delete next[id];
      return next;
    });

  return {
    calls,
    checklist,
    setChecklist,
    live,
    start,
    tick,
    jot,
    end,
    decisions,
    decide,
    profile: applyCalls(base, calls, decisions),
    pending: pendingUpdates(calls, decisions),
  };
}

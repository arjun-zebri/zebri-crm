'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { TODAY, addDays } from '../payments/dates';

import { finish, type Proposal, type ProposalSeed } from './proposals-data';

/**
 * What the MC has done on the Proposals page this visit: nudges sent,
 * proposals marked accepted, expiries pushed out and proposals
 * withdrawn. Shared by every tab and the proposal modal, so a nudge sent
 * from the Overview shows on the row and in the modal's history at once.
 * Demo only: nothing is saved, a reload starts over. The proposals
 * themselves are the account's, passed in, so a new account's list
 * changes as it sends and its client replies.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/use-proposals-state
 */

/** Long enough to see the spinner, short enough not to feel slow. */
const NUDGE_MS = 900;
/** How far Extend expiry pushes it out. */
const EXTEND_DAYS = 14;

type Change = 'accepted' | 'extended' | 'withdrawn';

/** What the views read and call. See {@link useProposalsState}. */
export interface ProposalsState {
  proposals: Proposal[];
  /** Ids nudged this visit. */
  nudged: ReadonlySet<string>;
  nudge: (id: string) => void;
  /** Sends each couple their own drafted nudge; `nudging` while it goes. */
  nudgeAll: (ids: string[]) => void;
  nudging: boolean;
  markAccepted: (id: string) => void;
  extend: (id: string) => void;
  withdraw: (id: string) => void;
}

/** Applies what the MC did this visit to a seed. */
function apply(s: ProposalSeed, changes: ReadonlyMap<string, Change[]>, nudged: ReadonlySet<string>): ProposalSeed {
  let p = s;
  const add = (text: string) => [{ when: 'Just now', text }, ...p.history];
  if (nudged.has(s.id)) p = { ...p, nudgedOn: TODAY, history: add('You sent a nudge') };
  for (const c of changes.get(s.id) ?? []) {
    if (c === 'accepted') p = { ...p, acceptedOn: TODAY, chosen: p.leaning, history: add('Marked accepted by you') };
    if (c === 'extended') p = { ...p, expiresOn: addDays(p.expiresOn ?? TODAY, EXTEND_DAYS), history: add(`Expiry pushed out ${EXTEND_DAYS} days`) };
    if (c === 'withdrawn') p = { ...p, declinedOn: TODAY, history: add('Withdrawn by you') };
  }
  return p;
}

/** Proposals page state over the account's proposals (`seeds`). See {@link ProposalsState}. */
export function useProposalsState(seeds: ProposalSeed[]): ProposalsState {
  const [nudged, setNudged] = useState<ReadonlySet<string>>(() => new Set());
  const [changes, setChanges] = useState<ReadonlyMap<string, Change[]>>(() => new Map());
  const [nudging, setNudging] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const proposals = useMemo(() => seeds.map((s) => finish(apply(s, changes, nudged))), [seeds, changes, nudged]);
  const change = (id: string, c: Change) => setChanges((m) => new Map(m).set(id, [...(m.get(id) ?? []), c]));
  return {
    proposals,
    nudged,
    nudge: (id) => setNudged((s) => new Set(s).add(id)),
    nudgeAll(ids) {
      setNudging(true);
      timer.current = window.setTimeout(() => {
        setNudged((s) => new Set([...s, ...ids]));
        setNudging(false);
      }, NUDGE_MS);
    },
    nudging,
    markAccepted: (id) => change(id, 'accepted'),
    extend: (id) => change(id, 'extended'),
    withdraw: (id) => change(id, 'withdrawn'),
  };
}

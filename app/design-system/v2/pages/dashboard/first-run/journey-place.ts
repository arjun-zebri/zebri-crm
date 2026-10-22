import { useMemo } from 'react';

import type { Account } from '../account';
import { kept } from '../doc-builder/state/kept';
import { stepsAhead } from '../journeys/journey-ahead';
import type { Visitor } from '../journeys/journey-path';
import type { Journey } from '../journeys/journeys-data';
import { starterJourney } from '../journeys/starter-journey';
import type { JourneysSource } from '../journeys/use-journeys';
import { TODAY, shortDate } from '../payments/dates';
import { coupleName } from '../payments/payments-data';

import type { Stored } from './derive';
import type { NewAccount } from './use-new-account';

/**
 * The first run's journey: its own store, so a new account's starter
 * journey (built from the roles picked in setup) never mixes with the
 * main dashboard's demo journeys, and where the test client is on it.
 *
 * The test client is never stored on the journey. Their place is worked
 * out from what has happened (accepted, signed, paid), so the line moves
 * them down as their scripted replies land, with nothing to keep in step.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/journey-place
 */

/** The first run's journeys, per run (`Progress.journeysId`), so every new setup starts clean. */
export const FIRST_RUN_JOURNEYS = kept<Journey[]>('zebri-v2-first-run-journeys');

/**
 * Where `client` is on the starter journey: the step that is next for
 * them. Proposal until they accept; the contract until they sign (or
 * straight to the deposit when the proposal booked without one); the
 * deposit until it is paid; then the planning call, the MC's own next
 * step, with when it is due (`planningBy`, "26 Feb"). Everything above
 * their step is done for them (`passed`), so the line ticks it off.
 */
export function placeOf(account: Account, client: Stored, planningBy?: string): Visitor {
  const who = coupleName(client.names);
  const mine = <T extends { names: [string, string] }>(xs: T[]) => xs.filter((x) => coupleName(x.names) === who);
  const accepted = mine(account.proposals).some((x) => x.acceptedOn);
  const signed = mine(account.contracts).some((x) => x.group === 'signed');
  const invoiced = mine(account.invoices).length > 0;
  const paid = mine(account.invoices).some((x) => x.paidOn);
  const step = !accepted ? 'proposal' : paid ? 'planning' : signed || invoiced ? 'deposit' : 'contract';
  return { step, names: client.names, passed: true, avatars: false, status: step === 'planning' && planningBy ? `Due ${planningBy}` : undefined };
}

/** When step `id` of `journey` falls for `client` ("12 Feb"), counted from their event date. */
export function dateOf(journey: Journey | undefined, client: Stored, id: string): string | undefined {
  if (!journey || !client.date) return undefined;
  return stepsAhead(journey, client.date, TODAY).find((a) => a.id === id)?.when;
}

/**
 * What the first run's Journeys page runs on: the new account's own
 * starter journey (from the roles picked in setup, the test client's day
 * on its marker) and the test client on their step. The seed is
 * memoised: the store shows it until the first change, and a new array
 * every render would read as a change.
 */
export function useFirstRunJourneys(na: NewAccount): { source: JourneysSource; visitors: Visitor[] } {
  const tester = na.progress.clients.find((c) => c.test);
  const roles = na.handoff.profile.roles.join(',');
  const seed = useMemo(
    () => [
      starterJourney(
        roles ? roles.split(',') : [],
        // The date beside the marker only: the couple's name on the day card read as theirs alone (founder, 2026-10-08).
        tester ? { who: '', date: tester.date ? shortDate(tester.date) : undefined } : undefined,
      ),
    ],
    [roles, tester],
  );
  const placed = tester ? placeOf(na.account, tester, dateOf(seed[0], tester, 'planning')) : null;
  return {
    source: { store: FIRST_RUN_JOURNEYS, owner: na.progress.journeysId ?? 'run', seed },
    // Shown only once booked: on the proposal mid practice run their avatars were noise (founder, 2026-10-08).
    visitors: placed && placed.step === 'planning' ? [placed] : [],
  };
}

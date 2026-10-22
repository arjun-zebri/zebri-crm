'use client';

import { useEffect, useRef } from 'react';

import { setBdmOn, startFresh, startPaperwork } from '../bdm/bdm-store';
import { BOOKED_FROM, STAGES, clientName, type Client } from '../clients/clients-data';

/**
 * The Lodge with BDM block on the new account. The block's store starts
 * with the demo business's couples, so the first run clears them and
 * puts the celebrant under the account's own name; then, while the block
 * is added, every booked client has their paperwork waiting, as a run
 * sheet is, so the Documents list is this account's couples and nobody
 * else's.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/use-first-run-bdm
 */
export function useFirstRunBdm(on: boolean, name: string, clients: readonly Client[]) {
  const fresh = useRef(false);
  // Before the block can show anything: `on` is still false on the first commit.
  useEffect(() => {
    if (fresh.current) return;
    fresh.current = true;
    startFresh(name);
  }, [name]);
  useEffect(() => setBdmOn(on), [on]);
  useEffect(() => {
    if (!on) return;
    // startPaperwork skips a couple who already have theirs, so this is safe on every change.
    clients
      .filter((c) => STAGES.indexOf(c.stage) >= BOOKED_FROM)
      .forEach((c) => startPaperwork(clientName(c), c.names, c.date, c.venue, c.email));
  }, [on, clients]);
}

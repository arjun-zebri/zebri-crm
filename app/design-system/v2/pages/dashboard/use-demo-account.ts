'use client';

import { useMemo, useState } from 'react';

import { DEMO_ACCOUNT, type Account, type NewClient } from './account';
import type { Client } from './clients/clients-data';
import { toClient } from './first-run/derive';

/**
 * The demo business with a working New client: clients added on the
 * Clients page join the list (newest first) for as long as the page is
 * open. Everything else stays view only, as {@link DEMO_ACCOUNT} is.
 *
 * @module app/design-system/v2/pages/dashboard/use-demo-account
 */
export function useDemoAccount(): Account {
  const [added, setAdded] = useState<Client[]>([]);
  return useMemo(
    () => ({
      ...DEMO_ACCOUNT,
      clients: [...added, ...DEMO_ACCOUNT.clients],
      addClient(c: NewClient) {
        const id = `client-${Date.now()}`;
        setAdded((a) => [toClient({ id, ...c, test: false, addedAt: Date.now() }, false, false), ...a]);
        return id;
      },
    }),
    [added],
  );
}

'use client';

import { useState } from 'react';

import { useAccount } from '../../account';
import { renamePaperwork } from '../../bdm/bdm-store';
import { renameRunSheet } from '../../home/run-sheet-store';
import { useJourneys } from '../../journeys/use-journeys';
import { clientName, type Client } from '../clients-data';

import type { Person } from './profile-data';

/**
 * A client's Primary and Secondary contact on their profile, edited in
 * place on the Overview (user, 2026-10-15). `typed` is what the two lines
 * hold; `names` is the last pair with a primary contact, which is what
 * the profile's title and everything else goes by, so clearing the
 * primary to retype it never leaves the client nameless.
 *
 * A change cascades to everything that names the partners: the account's
 * client (the Clients list, proposals, invoices), their journey, and the
 * paperwork and run sheet, which are kept by the client's name and so are
 * moved to the new one. The demo business has no `setNames`, so there the
 * rename lasts the visit.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/use-client-names
 */

const BLANK: Omit<Person, 'name'> = {
  role: 'Client',
  prefers: 'no preference yet',
  email: '',
  phone: '',
};

/** A client's contacts on their profile, and renaming them. See the module above. */
export function useClientNames(client: Client) {
  const account = useAccount();
  const journeys = useJourneys(account.journeys);
  const [typed, setTyped] = useState<[string, string]>(client.names);
  const [names, setNames] = useState<[string, string]>(client.names);
  // How many of the profile's people are the client themselves (the first one or two).
  const [contacts] = useState(() => client.names.filter(Boolean).length);
  const change = (next: [string, string]) => {
    setTyped(next);
    const clean: [string, string] = [next[0].trim(), next[1].trim()];
    if (!clean[0]) return;
    const from = clientName({ names });
    const to = clientName({ names: clean });
    setNames(clean);
    renamePaperwork(from, to, clean);
    renameRunSheet(from, to);
    if (from !== to) journeys.renamePerson(client.id, to);
    account.setNames?.(client.id, clean);
  };
  /** The profile's people with the contacts as named now; anyone else (a venue coordinator) after them. */
  const people = (all: Person[]): { contacts: Person[]; others: Person[] } => ({
    // A secondary contact added here has no details yet.
    contacts: names
      .filter(Boolean)
      .map((name, i) => ({ ...((i < contacts && all[i]) || BLANK), name })),
    others: all.slice(contacts),
  });
  return { typed, names, who: clientName({ names }), change, people };
}

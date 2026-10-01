import type { DemoPackage } from '../../../onboarding/packages';
import type { Clause } from '../../account';
import type { Client } from '../../clients/clients-data';
import { TODAY, addDays } from '../dates';
import { finish, type Contract, type Invoice } from '../payments-data';

/**
 * The contract and invoice a New contract or New invoice editor shows
 * while the MC works on them: built from the client, the package they
 * accepted and what the side panel says, in the same shapes the previews
 * already draw, so the preview is the real document, not a mock of it.
 *
 * @module app/design-system/v2/pages/dashboard/payments/modal/drafts
 */

/** An unsent contract for `client`, signed by the MC when they have a signature. */
export function draftContract(client: Client, pkg: DemoPackage, mc: string, clauses: Clause[], signed: boolean): Contract {
  return {
    id: 'draft',
    names: client.names,
    title: 'Service agreement',
    item: pkg.name,
    total: pkg.price,
    event: `${client.date} · ${client.venue}`,
    when: 'Not sent',
    group: 'waiting',
    signers: [
      ...client.names.filter(Boolean).map((n) => ({ name: n, role: 'Client' as const, signed: null })),
      { name: mc, role: 'You', signed: signed ? 'Today' : null },
    ],
    history: [],
    clauses,
  };
}

/** An unsent deposit invoice for `client`: `percent` of the package, due in `dueDays`. */
export function draftInvoice(client: Client, pkg: DemoPackage, number: number, percent: number, dueDays: number, note: string): Invoice {
  return finish({
    id: 'draft',
    number,
    names: client.names,
    label: 'Deposit',
    amount: Math.round((pkg.price * percent) / 100),
    item: pkg.name,
    total: pkg.price,
    paidBefore: 0,
    dueOn: addDays(TODAY, dueDays),
    paidOn: null,
    method: null,
    sentOn: TODAY,
    history: [],
    note: note.trim() || undefined,
  });
}

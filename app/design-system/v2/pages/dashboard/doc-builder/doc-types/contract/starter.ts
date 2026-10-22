import { column, columns, doc, heading, hr, paragraph, text, variable } from '@/features/proposals';
import type { RichDoc } from '@/features/proposals';

import type { Account, Clause } from '../../../account';
import { CLAUSES } from '../../../payments/modal/contract-clauses';
import type { DocLayout } from '../../model/types';
import { headerSection } from '../../sections/header/data';
import { partSection } from '../../sections/parts/parts';
import { words } from '../proposal/starter-sections';
import { fact, muted } from '../words';

/**
 * Zebri's starting contract, the one a new MC or Celebrant opens on Set
 * up and edits in place (founder, 2026-10-21: one place for the words
 * and the look, set up by someone who has never used a CRM). The title,
 * who it is between and every clause are ordinary text, typed over like
 * a proposal's, with `@` fields for the couple, the business and the
 * booking (`./fields.ts`): the booking details are words and fields in
 * two columns, retyped or deleted like the rest. Only the signing lines
 * stay a working part, since that is where couples sign; who signs and
 * how the lines sit are the MC's choice (`signaturesOf`). Saving it
 * makes it the contract every client gets; a sent contract keeps its own
 * copy (`Contract.layout`).
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/contract/starter
 */

/**
 * The standard wording, in the MC's own role: the clauses say "the MC",
 * which a Celebrant's contract reads as "the Celebrant".
 */
export function clausesFor(account: Account): Clause[] {
  const clauses = account.terms ?? CLAUSES;
  const role = account.mc?.role ?? 'MC';
  if (role === 'MC') return clauses;
  const swap = (s: string) => s.replace(/\bMC\b/g, role);
  return clauses.map(([title, body]) => [swap(title), swap(body)]);
}

/**
 * The booking at a glance, between two rules, in two columns: words and
 * fields the MC can retype, reorder or delete like any others. It opens
 * the clauses' section rather than being one of its own: a section
 * ending in columns gets the editor's empty line after it, a gap the MC
 * could not remove.
 */
const bookingDetails = (): RichDoc[] => [
  hr(),
  columns(
    column(1, fact('Event', variable('event_date')), fact('Fee', variable('fee'))),
    column(1, fact('Package', variable('package_name')), fact('Deposit and balance', variable('deposit_amount'), text(' on signing, '), variable('balance_amount'), text(' '), variable('balance_due'))),
  ),
  hr(),
];

/** The contract's starting page for `account`. */
export function contractStarter(account: Account): DocLayout {
  const role = account.mc?.role ?? 'MC';
  const opening = doc(
    heading(2, text('Service agreement')),
    paragraph(text('Between '), variable('business_name'), text(` (the ${role}) and `), variable('couple_name'), text(' (the Client)')),
  );
  const terms = doc(...bookingDetails(), ...clausesFor(account).flatMap(([title, body], n) => [heading(3, text(`${n + 1}. ${title}`)), paragraph(text(body))]));
  const business = account.contact ? `${account.business} · ABN ${account.contact.abn}` : account.business;
  return {
    version: 2,
    sections: [
      headerSection(),
      words('Title', opening, { padding: 'compact' }),
      words('Terms', terms, { padding: 'compact' }),
      words('Signing', doc(paragraph(text(`Signed by the ${role} and the Client, agreeing to the above.`))), { padding: 'compact' }),
      partSection('signatures', 'Signatures', { padding: 'compact' }),
      words('Footer', doc(paragraph(muted(business))), { align: 'center', padding: 'compact' }),
    ],
  };
}

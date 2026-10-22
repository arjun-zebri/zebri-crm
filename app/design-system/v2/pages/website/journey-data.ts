import type { Account } from '../dashboard/account';
import type { Paperwork } from '../dashboard/bdm/bdm-data';
import { demoAnswers } from '../dashboard/bdm/bdm-seeds';
import type { EmailBlock } from '../dashboard/email/email-data';
import { noteFor } from '../dashboard/payments/modal/invoice-email';
import { finish, type Contract } from '../dashboard/payments/payments-data';
import { BRAND } from '../dashboard/proposals/templates-data';
import type { DemoPackage } from '../onboarding/packages';

import { SITE_ACCOUNT } from './site-account';

/**
 * DEMO CONTENT for the Journeys band: Mia and Leo's booking with a
 * fictional Celebrant, Jess Taylor (the hero's MC), as every document in
 * `journey-docs.tsx` is fed it. Names, dates, prices and wording are
 * illustrative. The prices add up: a $2,000 package, a 25% deposit of
 * $500, and a $1,500 balance.
 *
 * @module app/design-system/v2/pages/website/journey-data
 */

/** The Celebrant every document comes from. */
export const ACCOUNT: Account = {
  // Jess and Mia & Leo's wedding as every band shows them (`site-account.ts`).
  ...SITE_ACCOUNT,
  // The default brand: its deep green carries white text, where the Blocks images'
  // light green turned the invoice's amount and button dark on green.
  brand: BRAND,
};

/** Where the wedding is. */
export const VENUE = 'Bendooley Estate, Berrima';

/** The wedding, as the proposal's cover and Accept name it. */
export const MIA_AND_LEO = { couple: 'Mia & Leo', date: 'Saturday 13 March 2027', venue: VENUE, greet: 'Mia and Leo' };

/** The one package offered: $2,000, so the 25% deposit is the shot's $500. */
export const CEREMONY: DemoPackage = {
  name: 'Ceremony package',
  price: 2000,
  lines: ['Your ceremony, written with you', 'NOIM, paperwork and lodgement', 'Rehearsal on site', 'PA and two mics'],
};

/** The thank-you email's words, sent the moment they enquire. */
export const WELCOME: EmailBlock[] = [
  {
    kind: 'text',
    text: 'Hi Mia and Leo,\n\nThank you so much for reaching out, and congratulations! Saturday 13 March at Bendooley sounds beautiful, and I would love to be part of it.\n\nYour proposal is on its way, with everything we talked about.',
  },
  { kind: 'button', label: 'View your proposal' },
];

/** The proposal's welcome, in a Celebrant's words (the default note is an MC's: "the last dance"). */
export const PROPOSAL_WELCOME =
  'Hi Mia and Leo, thank you for thinking of me for your ceremony. I would love to write something that sounds like the two of you, and to make the moment you say I do feel easy and completely yours.';

/** The Celebrant agreement, signed by all three. */
export const CONTRACT: Contract = {
  id: 'site-mia-leo',
  names: ['Mia', 'Leo'],
  title: 'Celebrant agreement',
  item: CEREMONY.name,
  total: CEREMONY.price,
  event: `Sat 13 Mar 2027 · ${VENUE}`,
  when: 'Signed Wed 9 Sep',
  group: 'signed',
  signers: [
    { name: 'Jess Taylor', role: 'You', signed: 'Tue 8 Sep' },
    { name: 'Mia Rossi', role: 'Client', signed: 'Wed 9 Sep' },
    { name: 'Leo Grant', role: 'Client', signed: 'Wed 9 Sep' },
  ],
  history: [],
  // A Celebrant's terms: the standard wording is written for an MC's work.
  clauses: [
    ['Services', 'The Celebrant will write the ceremony with the Client, rehearse it on site and conduct it on the day, as set out in the package above.'],
    ['Notice and paperwork', 'The Client will give the Notice of Intended Marriage at least one month before the wedding. The Celebrant will check it and register the marriage with NSW Births, Deaths and Marriages within 14 days after.'],
    ['Booking and deposit', 'The date is held for the Client once this agreement is signed and the deposit is paid. Until both are done, the Celebrant may offer the date to others.'],
    ['Payment', 'The balance is due 14 days before the wedding, by card or bank transfer. All amounts are in Australian dollars and include GST.'],
    ['Cancellation', 'The deposit is not refundable. If the Client cancels within 60 days of the wedding, the full fee is payable. A cancellation must be made in writing.'],
  ],
};

/** The $500 deposit invoice. */
export const DEPOSIT = finish({
  id: 'site-deposit',
  number: 1031,
  names: ['Mia', 'Leo'],
  label: 'Deposit',
  amount: 500,
  item: CEREMONY.name,
  total: CEREMONY.price,
  paidBefore: 0,
  dueOn: '2026-09-16',
  paidOn: null,
  method: null,
  sentOn: '2026-09-09',
  history: [],
  note: noteFor('Mia and Leo'),
});
/**
 * The $1,500 balance, the final payment: sent and paid by card 14 days
 * before the wedding, as the journey's last step says.
 */
export const BALANCE_INVOICE = finish({
  id: 'site-balance',
  number: 1058,
  names: ['Mia', 'Leo'],
  label: 'Final payment',
  amount: 1500,
  item: CEREMONY.name,
  total: CEREMONY.price,
  paidBefore: 500,
  dueOn: '2027-02-27',
  paidOn: '2027-02-27',
  method: 'Card',
  sentOn: '2027-02-13',
  history: [],
  note: 'Hi Mia and Leo, here is the last of it, due two weeks before the big day. Once it is paid, all that is left is the fun part.',
});
/** When the balance falls due, for the invoice's schedule. */
export const BALANCE = { span: { count: 14, unit: 'days' as const }, eventOn: '2027-03-13' };

/** Mia and Leo's NOIM, filled in with the product's own demo answers; their surnames as the invoices bill them (`personOf`). */
export const PAPERWORK: Paperwork = {
  client: 'Mia & Leo',
  names: ['Mia', 'Leo'],
  date: 'Sat 13 Mar 2027',
  venue: VENUE,
  stage: 'sent',
  answers: demoAnswers(['Mia Rossi', 'Leo Grant']),
  checks: {},
  certificate: 'none',
};

import type { Account } from '../account';
import { addDays, TODAY } from '../payments/dates';
import { coupleName, finish, type Invoice, type InvoiceSeed } from '../payments/payments-data';
import { PACKAGES } from '../proposals/templates-data';

/**
 * The MC's invoice templates: how a booking is billed (a deposit to hold
 * the date and the balance before the event, or three payments), each
 * with a sample invoice for its card and preview. An account has them
 * once it has invoiced someone, since every invoice it sent was made
 * from one; a brand new account starts with none. Demo only: worked out
 * from the account's invoices, nothing is saved.
 *
 * @module app/design-system/v2/pages/dashboard/documents/invoice-templates
 */

export type InvoiceTemplateId = 'deposit-balance' | 'three-payments';

/** One way of billing a booking. */
export interface InvoiceTemplate {
  id: InvoiceTemplateId;
  name: string;
  /** One line on when to use it, under the name. */
  use: string;
  /** The invoice its preview shows: the one that sets it apart. */
  sample: Invoice;
  /** How a booking is paid, in order: each payment's share and when it falls due. Its card draws these. */
  parts: { share: number; when: string }[];
  /** How many bookings the account has billed with it (couples, not payments). */
  used: number;
}

/** The sample couple, on the same package the proposal templates open with. */
const SAMPLE = { names: ['Sarah', 'Tom'] as [string, string], item: 'Premium MC package', total: PACKAGES.premium.price };

/** The sample couple's first invoice, as `label` for `amount`. */
export function sampleInvoice(label: InvoiceSeed['label'], amount: number, paidBefore: number): Invoice {
  return finish({
    id: `sample-${label}`,
    number: 1001,
    ...SAMPLE,
    label,
    amount,
    paidBefore,
    dueOn: addDays(TODAY, 7),
    sentOn: TODAY,
    paidOn: null,
    method: null,
    history: [],
    note: label === 'Deposit' ? 'Thank you for booking. This secures your date.' : 'Thank you. Halfway there.',
  });
}

/** The sample couple's deposit invoice at the account's deposit share. */
export const sampleDeposit = (account: Account) => sampleInvoice('Deposit', Math.round((SAMPLE.total * account.deposit) / 100), 0);

/** The account's invoice templates, or none before its first invoice. */
export function invoiceTemplatesOf(account: Account): InvoiceTemplate[] {
  if (account.invoices.length === 0) return [];
  // A couple with a second payment was billed in three; everyone else in two.
  const threePart = new Set(account.invoices.filter((i) => i.label === 'Second payment').map((i) => coupleName(i.names)));
  const couples = new Set(account.invoices.map((i) => coupleName(i.names)));
  const inThree = threePart.size;
  const all: InvoiceTemplate[] = [
    {
      id: 'deposit-balance',
      name: 'Deposit and balance',
      use: `${account.deposit}% to hold the date, the rest two weeks before`,
      sample: sampleDeposit(account),
      parts: [
        { share: account.deposit, when: 'On booking' },
        { share: 100 - account.deposit, when: '14 days before' },
      ],
      used: couples.size - inThree,
    },
    {
      id: 'three-payments',
      name: 'Three payments',
      use: 'A deposit, a second payment halfway, then the balance',
      // Its card shows the payment that sets it apart from the two-part template.
      sample: sampleInvoice('Second payment', Math.round(SAMPLE.total / 3), Math.round((SAMPLE.total * account.deposit) / 100)),
      parts: [
        { share: account.deposit, when: 'On booking' },
        { share: Math.round((100 - account.deposit) / 2), when: 'Halfway' },
        { share: 100 - account.deposit - Math.round((100 - account.deposit) / 2), when: '14 days before' },
      ],
      used: inThree,
    },
  ];
  // A new account's first invoice is a plain deposit: only the two-part template is theirs yet.
  return all.filter((t) => t.used > 0);
}

/** "Used for 9 bookings", "Not sent yet". */
export const usedLine = (n: number) => (n === 0 ? 'Not sent yet' : `Used for ${n} ${n === 1 ? 'booking' : 'bookings'}`);

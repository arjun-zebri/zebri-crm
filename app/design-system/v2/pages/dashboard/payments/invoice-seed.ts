import { TODAY, addDays, shortDate } from './dates';
import type { InvoiceSeed } from './payments-data';
import { SERVICES } from './services';

/**
 * The MC's other bookings for the Payments demo: a fixed pattern of
 * invoices over two financial years (July 2025 to June 2027), so the
 * Overview has a believable year behind it and reads the same on every
 * load. Spring and autumn are wedding season, so those months carry more;
 * months further ahead thin out, as fewer bookings are in yet.
 * September 2026, the month the demo is set in, holds only the named
 * invoices in `payments-data.ts`. Couples paying by card pay within a
 * couple of days of the invoice; bank transfers take over a week, as
 * they tend to (the Overview's insights read this back).
 *
 * @module app/design-system/v2/pages/dashboard/payments/invoice-seed
 */

/** Invoices per month, July to June. */
const PER_MONTH = [2, 3, 3, 4, 4, 3, 2, 3, 4, 4, 2, 2];
const AMOUNTS = [1200, 900, 1450, 1100, 1600, 1000, 1300, 800];
const LABELS: InvoiceSeed['label'][] = ['Deposit', 'Second payment', 'Final payment'];
const POOL: [string, string][] = [
  ['Ruby', 'Tom'], ['Lily', 'Hugo'], ['Ava', 'Kai'], ['Maya', 'Josh'], ['Emma', 'Will'],
  ['Nina', 'Raj'], ['Tess', 'Luca'], ['Kate', 'Finn'], ['Eve', 'Oscar'], ['Lucy', 'Arlo'],
];
/** Every package on offer, MC's first. */
const PACKAGES = SERVICES.flatMap((s) => s.packages);
/** Which package each booking in turn is: MC work is most of it, the rest a steady side line. */
const MIX = [0, 2, 1, 3, 0, 4, 1, 2, 0, 3, 4, 1];

const pad = (n: number) => String(n).padStart(2, '0');

/** The generated invoices, oldest first. */
export function generatedSeeds(): InvoiceSeed[] {
  const out: InvoiceSeed[] = [];
  let past = 900;
  let future = 1100;
  for (let m = 0; m < 24; m++) {
    const year = 2025 + Math.floor((m + 6) / 12);
    const month = ((m + 6) % 12) + 1;
    if (year === 2026 && month === 9) continue;
    const ahead = year > 2026 || (year === 2026 && month > 9);
    const count = PER_MONTH[m % 12]! - (ahead ? 1 + Math.floor((m - 15) / 4) : 0);
    for (let k = 0; k < count; k++) {
      const date = `${year}-${pad(month)}-${pad(Math.min(28, 3 + k * 8 + (m % 5)))}`;
      const names = POOL[(m * 3 + k) % POOL.length]!;
      const label = LABELS[(m + k) % LABELS.length]!;
      const amount = AMOUNTS[(m * 5 + k) % AMOUNTS.length]!;
      const pkg = PACKAGES[MIX[(m * 3 + k) % MIX.length]!]!;
      const paidBefore = label === 'Deposit' ? 0 : label === 'Final payment' ? pkg.total - amount : Math.min(1200, pkg.total - amount);
      const sends = addDays(date, -7);
      const method = (m + k) % 3 === 0 ? 'Bank transfer' : 'Card';
      out.push({
        id: `inv-${ahead ? future : past}`,
        number: ahead ? future++ : past++,
        names,
        label,
        amount,
        ...pkg,
        paidBefore,
        // A paid one fell due a few days after it was paid.
        dueOn: ahead ? date : addDays(date, 4),
        paidOn: ahead ? null : date,
        method: ahead ? null : method,
        zebriSends: ahead && sends > TODAY ? sends : undefined,
        // Days from the invoice going out to the money landing, by how they pay.
        sentOn: ahead ? (sends <= TODAY ? sends : undefined) : addDays(date, method === 'Card' ? -(1 + (k % 3)) : -(8 + (m % 4))),
        openedBy: ahead ? undefined : names[0],
        openedOn: ahead ? undefined : addDays(date, method === 'Card' ? -1 : -7),
        history: ahead
          ? sends > TODAY
            ? [{ when: shortDate(sends), text: `Zebri sends it to ${names[0]} and ${names[1]}` }]
            : [{ when: shortDate(sends), text: `Sent to ${names[0]} and ${names[1]}` }]
          : [{ when: shortDate(date), text: `Paid by ${names[0]}, ${method.toLowerCase()}` }],
      });
    }
  }
  return out;
}

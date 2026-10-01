import type { Clause } from '../../account';

/**
 * Zebri's standard MC agreement: what every contract says until the MC
 * brings in their own. Written for an MC's work (the formalities, the
 * run sheet, the day itself) and for Australia (GST, dollars), and says
 * "event" throughout, never "wedding", so it fits any booking.
 *
 * It is not editable in the send flow; the MC's own wording comes later,
 * brought in or written in the contract builder.
 *
 * @module app/design-system/v2/pages/dashboard/payments/modal/contract-clauses
 */

/** The standard clauses, in order. The preview puts the first {@link FIRST_PAGE} on page one. */
export const CLAUSES: Clause[] = [
  [
    'Services',
    'The MC will host the event as set out in the package above: running the formalities to the agreed run sheet, introducing speakers and key moments, and keeping time with the venue and other suppliers on the day.',
  ],
  [
    'Planning',
    'The MC will meet the Client once before the event, in person or by video, and prepare the run sheet with them. The Client will confirm names, pronunciations and the final running order at least 14 days before the event.',
  ],
  [
    'Booking and deposit',
    'The date is held for the Client once this agreement is signed and the deposit is paid. Until both are done, the MC may offer the date to others.',
  ],
  [
    'Payment',
    'The balance is due 14 days before the event, by card or bank transfer. All amounts are in Australian dollars and include GST.',
  ],
  [
    'Cancellation',
    'The deposit is not refundable. If the Client cancels within 60 days of the event, the full fee is payable. A cancellation must be made in writing.',
  ],
  [
    'Changing the date',
    'If the event moves, the MC will host on the new date if they are free, and payments made carry over. If the MC is not free on the new date, the change is treated as a cancellation.',
  ],
  [
    'If the MC cannot attend',
    'If illness or an emergency stops the MC from attending, they will arrange an experienced replacement MC the Client approves, or refund every payment made.',
  ],
  [
    'On the day',
    'The MC will arrive at least 30 minutes before the formalities begin. Where guests are served a meal, the Client will arrange one for the MC, along with a working microphone and PA.',
  ],
  [
    'Liability',
    'The MC holds public liability insurance. Their liability under this agreement is limited to the fee paid. Neither party is responsible for delays or failures caused by events outside their reasonable control.',
  ],
  [
    'The whole agreement',
    'This is the whole agreement between the MC and the Client. Any change must be agreed in writing. It is governed by the laws of the state in which the event is held.',
  ],
];

/** How many clauses fit on page one, under the parties and the summary. */
export const FIRST_PAGE = 5;

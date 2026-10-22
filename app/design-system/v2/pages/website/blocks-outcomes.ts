/**
 * The Blocks row's six outcomes, in the order a booking runs: what Zebri
 * does for an MC's week, each an outcome first and the how second, tied
 * to the block that does it (whose real product image shows it).
 * Founder, 2026-10-18: a newcomer does not care where blocks go until
 * they use it, so this sells what is in it for them; the full catalogue
 * is a page of its own (`blocks-page.tsx`).
 *
 * Every line is the catalogue's own claim reworded, never a new one.
 * Keep them that way: what a block can do is in `catalog.ts`. Titles fit
 * one line at three across, so the cards' text lines up row to row.
 *
 * @module app/design-system/v2/pages/website/blocks-outcomes
 */

/** One outcome card. */
export interface Outcome {
  /** The block that delivers it, by catalogue id. */
  block: string;
  /** What the visitor gets, in their words. */
  title: string;
  /** How, in one line. */
  how: string;
}

/** The six outcomes, from first message to the night itself. */
export const OUTCOMES: readonly Outcome[] = [
  { block: 'lead-capture', title: 'Enquiries answered fast', how: 'Emails and Instagram DMs in one list, with a reply drafted for you.' },
  { block: 'scheduler', title: 'Calls booked around you', how: 'One link. Zebri checks your calendar and sends the invite.' },
  { block: 'video', title: 'Notes that write themselves', how: 'Meet in the browser. Names, timings and to-dos are saved on the couple.' },
  { block: 'proposals', title: 'Booked on one page', how: 'Couples pick a package, sign and pay the deposit in one go.' },
  { block: 'questionnaires', title: 'Every detail, asked once', how: 'Couples answer on their phone, and the answers land on their record.' },
  { block: 'timeline', title: 'The night, minute by minute', how: 'A run sheet the couple approves and every supplier can read.' },
];

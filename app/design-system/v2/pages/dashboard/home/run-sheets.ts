import { BOOKED_FROM, CLIENTS, STAGES, clientName } from '../clients/clients-data';
import { RUN_SHEET, type RunSheetItem } from '../demo-activity';
import { NEXT_EVENT } from '../demo-data';

/**
 * The events a run sheet can be built for, and the sheet Zebri drafts
 * for one that has none yet. Sarah & Tom (the next event) already have
 * theirs; every other booked client starts from the draft.
 *
 * @module app/design-system/v2/pages/dashboard/home/run-sheets
 */

/** An event to build a run sheet for. */
export interface SheetEvent {
  client: string;
  /** "Sat 10 Oct 2026 · Hawthorn Hall", or "In 2 days" for the next one. */
  detail: string;
}

/** The next event first, then every booked client. */
export const SHEET_EVENTS: SheetEvent[] = [
  { client: NEXT_EVENT.client, detail: `In ${NEXT_EVENT.daysAway} days · Stones of the Yarra Valley` },
  ...CLIENTS.filter((c) => STAGES.indexOf(c.stage) >= BOOKED_FROM).map((c) => ({
    client: clientName(c),
    detail: `${c.date} · ${c.venue}`,
  })),
];

/** A wedding day in the usual order; nothing confirmed yet. */
const DRAFT: RunSheetItem[] = [
  { time: '3:00pm', moment: 'Ceremony', done: false },
  { time: '3:45pm', moment: 'Family photos', done: false },
  { time: '5:30pm', moment: 'Guests seated', done: false },
  { time: '6:00pm', moment: 'Bridal party entrance', done: false },
  { time: '7:15pm', moment: 'Speeches', done: false },
  { time: '8:30pm', moment: 'First dance', done: false },
  { time: '10:45pm', moment: 'Farewell', done: false },
];

/** A client's saved sheet, else theirs from the demo data, else Zebri's draft. */
export function sheetFor(client: string, saved: Record<string, RunSheetItem[]>): RunSheetItem[] {
  return saved[client] ?? (client === NEXT_EVENT.client ? RUN_SHEET : DRAFT);
}

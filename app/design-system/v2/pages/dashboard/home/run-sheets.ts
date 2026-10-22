import { parseTime } from '@/components/ui-v2/time-field';

import { BOOKED_FROM, CLIENTS, STAGES, clientName } from '../clients/clients-data';
import { NEXT_EVENT } from '../demo-data';

/**
 * What a run sheet is. The night is a list of moments in the order the
 * MC puts them (dragged, not sorted): each lasts so many minutes and
 * either has its time set ("Ceremony at 2:30 pm") or follows on from the
 * one before, so moving or lengthening one moves everything after it.
 * Each has notes for the mic (a song, who speaks, a name to say right),
 * who runs it, and, while the couple still owes an answer, the question
 * Zebri asks them.
 *
 * A sheet goes draft → with the couple (they answer and approve it) →
 * approved → shared with the suppliers, each of whom gets a link with
 * their own moments marked. Changing an approved sheet starts the next
 * version as a draft, so what the couple approved is never quietly
 * rewritten and suppliers keep the last shared one until the new one goes.
 *
 * A sheet belongs to one client's event: it lives in their Documents and
 * opens from Home's next-event row. It has no page of its own.
 *
 * @module app/design-system/v2/pages/dashboard/home/run-sheets
 */

/**
 * The kinds of supplier a moment can belong to, as every event has
 * them. An MC adds their own (a string quartet, a fireworks crew) from
 * the chip, kept in the store for every sheet after.
 */
export const VENDOR_TYPES = ['MC', 'Celebrant', 'DJ', 'Band', 'Photographer', 'Videographer', 'Venue', 'Caterer', 'Planner'];

/**
 * Where a moment stands while the night is planned, as an MC tracks it.
 * The MC adds their own from the chip (a "Needs a mic", a "Surprise:
 * don't share"), kept in the store for every sheet after.
 */
export const MOMENT_STATUSES = ['To confirm', 'Waiting on couple', 'Waiting on supplier', 'Confirmed'];

/** One moment of the night. */
export interface Moment {
  /** Lasts through edits and moves, for keys and dragging. */
  id: string;
  moment: string;
  /** Its set start ("2:30 pm"); empty when it follows on from the moment before. */
  time: string;
  /** How long it runs. */
  minutes: number;
  /** What the MC needs on the mic: a song, who speaks, a name to say right. */
  cue: string;
  /** The supplier type that runs it; empty when it is nobody in particular. */
  owner: string;
  /** A question the couple still owes for it ("Which song for your first dance?"). */
  ask?: string | undefined;
  /** The questionnaire answer its notes come from, so the couple's reply fills them. */
  field?: string | undefined;
  /** Ticked off on the night. */
  done?: boolean | undefined;
  /** Where it stands ("Confirmed"); empty when not set. */
  status?: string | undefined;
  /** Its colour on the day as `#rrggbb`, for the MC's own grouping; grey when not chosen. */
  color?: string | undefined;
}

/** Draft, with the couple to answer and approve, approved, or shared with the suppliers. */
export type SheetStatus = 'draft' | 'with-couple' | 'approved' | 'shared';

/** A client's run sheet. */
export interface RunSheet {
  moments: Moment[];
  status: SheetStatus;
  version: number;
  /** First name of who has it to approve; the client's first name when left out. */
  to?: string | undefined;
  /** On the night: minutes behind, added to everything not yet done. */
  late?: number | undefined;
  /** What just happened, for Zebri to say ("Sarah answered 2 questions and approved it"); cleared by the next edit. */
  news?: string | undefined;
}

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

/** "Sarah & Tom" → "Sarah": who it goes to first. */
export const firstOf = (client: string) => client.split(/\s*&\s*/)[0] ?? client;

/** Who has the sheet to approve: whoever it went to, else the client's first name. */
export const signerOf = (sheet: RunSheet, client: string) => sheet.to ?? firstOf(client);

/** A time as minutes for ordering; the small hours count as late the same night. */
export function minutesOf(time: string, after?: number): number | null {
  const m = parseTime(time, after);
  return m === null ? null : m < 4 * 60 ? m + 24 * 60 : m;
}

/** "1 hr 30 min", "45 min". */
export function lengthOf(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? (m ? `${h} hr ${m} min` : `${h} hr`) : `${m} min`;
}

/** The moments still waiting on an answer from the couple. */
export const asksOf = (sheet: RunSheet) => sheet.moments.filter((m) => m.ask);

/** The sheet's standing in words: "Draft", "With Sarah to approve", "Approved", "Shared with suppliers". */
export function statusOf(sheet: RunSheet, client: string): string {
  return sheet.status === 'draft'
    ? 'Draft'
    : sheet.status === 'with-couple'
      ? `With ${signerOf(sheet, client)} to approve`
      : sheet.status === 'approved'
        ? 'Approved'
        : 'Shared with suppliers';
}

let seq = 0;
/** A fresh moment id. */
export const newId = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;

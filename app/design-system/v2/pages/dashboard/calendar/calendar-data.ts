import { CLIENTS, clientName, type Client } from '../clients/clients-data';

/**
 * What the calendar popover shows: each client's event day, calls and
 * meetings, payment due dates, and busy times from a synced Google or
 * Outlook calendar. Demo content: everything but the event days is set
 * relative to today, so the popover always has something on; event
 * days come from the clients' own dates, so a click lands on a profile
 * that agrees with the calendar.
 *
 * @module app/design-system/v2/pages/dashboard/calendar/calendar-data
 */

/**
 * What a calendar item is. `event` is a client's event day, `meeting` a
 * call or in-person meeting, `due` a payment due date, and `synced` a
 * busy time from the MC's own calendar (no client, never clickable).
 */
export type CalendarKind = 'event' | 'meeting' | 'due' | 'synced';

/** A connected calendar a `synced` item comes from. */
export type CalendarSource = 'google' | 'outlook';

/** One item on the calendar. `day` is relative to today. */
export interface CalendarEvent {
  day: number;
  /** "3:15 pm"; empty for a whole-day item (an event day, a due date). */
  time: string;
  title: string;
  detail: string;
  kind: CalendarKind;
  /** The client it belongs to; a click opens their profile. */
  clientId?: string | undefined;
  /** Set on `synced` items. */
  source?: CalendarSource | undefined;
}

/** The dot colour for each kind, on the month and beside each row. */
export const KIND_DOT: Record<CalendarKind, string> = {
  event: 'bg-grass-500',
  meeting: 'bg-azure-500',
  due: 'bg-champagne-500',
  synced: 'bg-zebra-300',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Days from `today` to a client's "Sat 10 Oct 2026", or null if it does not parse. */
function daysUntil(date: string, today: Date): number | null {
  const [, d, m, y] = date.split(' ');
  const month = MONTHS.indexOf(m ?? '');
  if (!d || !y || month < 0) return null;
  const at = new Date(Number(y), month, Number(d));
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((at.getTime() - from.getTime()) / 86_400_000);
}

/** The event day of every client who has booked (Planning or Booked). */
export function eventDays(clients: readonly Client[], today: Date): CalendarEvent[] {
  return clients.flatMap((c) => {
    const day = c.stage === 'Planning' || c.stage === 'Booked' ? daysUntil(c.date, today) : null;
    return day === null ? [] : [{ day, time: '', title: clientName(c), detail: `Event · ${c.venue}`, kind: 'event' as const, clientId: c.id }];
  });
}

/** Calls, meetings and due dates on the demo clients, around today. */
const AROUND_TODAY: CalendarEvent[] = [
  { day: -3, time: '4:00 pm', title: 'Menu tasting with Grace & Sam', detail: 'In person · Bells at Killcare', kind: 'meeting', clientId: 'grace-sam' },
  { day: 0, time: '11:00 am', title: 'Call with Ella & Noah', detail: 'Planning check-in · Video', kind: 'meeting', clientId: 'ella-noah' },
  { day: 0, time: '3:15 pm', title: 'Intro call with Priya & Dev', detail: 'Booked via Intro call · Video', kind: 'meeting', clientId: 'priya-dev' },
  { day: 1, time: '', title: 'Final balance due', detail: 'Amelia & Jack · $1,450', kind: 'due', clientId: 'amelia-jack' },
  // Home's Up next leads with this event, so the calendar has to agree. Sarah & Tom have no client record in the demo, so it opens nothing.
  { day: 2, time: '2:30 pm', title: 'Sarah & Tom', detail: 'Event · Stones of the Yarra Valley', kind: 'event' },
  { day: 4, time: '6:00 pm', title: 'Venue walkthrough', detail: 'Priya & James · The Boathouse', kind: 'meeting', clientId: 'priya-james' },
  { day: 6, time: '', title: 'Deposit due', detail: 'Sophie & Max · $500', kind: 'due', clientId: 'sophie-max' },
  { day: 7, time: '10:00 am', title: 'Intro call with Mia & Leo', detail: 'Booked via Intro call · Video', kind: 'meeting', clientId: 'mia-leo' },
  { day: 12, time: '', title: 'Second instalment due', detail: 'Isla & Ethan · $1,100', kind: 'due', clientId: 'isla-ethan' },
];

/** The MC's own busy times, from each calendar once it is connected. */
export const SYNCED: CalendarEvent[] = [
  { day: 0, time: '8:30 am', title: 'Dentist', detail: 'Google Calendar', kind: 'synced', source: 'google' },
  { day: 1, time: '7:00 pm', title: 'Dinner with Mum', detail: 'Google Calendar', kind: 'synced', source: 'google' },
  { day: 2, time: '9:00 am', title: 'Voice coaching', detail: 'Outlook', kind: 'synced', source: 'outlook' },
  { day: 5, time: '12:30 pm', title: 'Accountant', detail: 'Outlook', kind: 'synced', source: 'outlook' },
  { day: 9, time: '6:00 pm', title: 'Five-a-side', detail: 'Google Calendar', kind: 'synced', source: 'google' },
];

/** The demo business's calendar, less anything synced (which the panel adds per connection). */
export const EVENTS: CalendarEvent[] = [...eventDays(CLIENTS, new Date()), ...AROUND_TODAY];

/** Sorts whole-day items first, then by time of day ("9:00 am" before "3:15 pm"). */
function minutes(time: string): number {
  const m = /^(\d+):(\d+)\s?(am|pm)$/.exec(time);
  if (!m) return -1;
  return ((Number(m[1]) % 12) + (m[3] === 'pm' ? 12 : 0)) * 60 + Number(m[2]);
}

/** Items on the day `offset` days from today, whole-day first, then by time. */
export const onDay = (events: readonly CalendarEvent[], offset: number) =>
  events.filter((e) => e.day === offset).sort((a, b) => minutes(a.time) - minutes(b.time));

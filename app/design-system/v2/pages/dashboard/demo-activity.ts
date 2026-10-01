/**
 * Made-up content behind the dashboard's clickable parts: the drafted
 * replies, the top-right lists and the next event's run sheet. Kept apart from `demo-data.ts` so each file stays small.
 *
 * @module app/design-system/v2/pages/dashboard/demo-activity
 */

/** Zebri's drafted reply to each waiting message, keyed by sender. */
export const DRAFTS: Record<string, string> = {
  'Sarah Bennett':
    "Of course! I'll move Tom's sister's reading ahead of the poem and update the run sheet so the celebrant has it too.",
  'Hannah Lee':
    'Family photos start right after the ceremony, at 3:15pm on the lawn. I will call the groups in order so nobody wanders off.',
};

/** Where an enquiry came in. */
export type EnquirySource = 'Email' | 'Instagram' | 'Website';

/** A new enquiry, newest first. `unread` until the MC opens it. */
export interface Enquiry {
  id: string;
  client: string;
  date: string;
  guests: number;
  message: string;
  source: EnquirySource;
  ago: string;
  unread: boolean;
}

export const ENQUIRIES: Enquiry[] = [
  { id: 'e1', client: 'Mia & Leo', date: 'Sat 14 Mar 2027', guests: 120, message: 'Loved your reel from Hawthorn Hall. Are you free for our date?', source: 'Instagram', ago: '1h', unread: true },
  { id: 'e2', client: 'Ella & Noah', date: 'Sat 6 Feb 2027', guests: 80, message: 'Hi! A friend recommended you. Could we get a quote?', source: 'Email', ago: '2d', unread: true },
  { id: 'e3', client: 'Grace & Sam', date: 'Sun 2 May 2027', guests: 150, message: 'Looking for on-the-day coordination at The Grainery.', source: 'Website', ago: '3d', unread: false },
  { id: 'e4', client: 'Priya & Dev', date: 'Sat 19 Jun 2027', guests: 200, message: 'Two-day celebration, ceremony and reception across both days.', source: 'Website', ago: '5d', unread: false },
];

/** What a notification is about, which sets its icon and tint. */
export type NotificationKind = 'payment' | 'booking' | 'comment' | 'signed' | 'deadline';

/**
 * Something that happened, newest first. `who` is set in black before
 * `what` ("Sarah & Tom" "paid their deposit"). `today` groups it under
 * Today rather than Earlier.
 */
export interface Notification {
  id: string;
  kind: NotificationKind;
  who: string;
  what: string;
  detail: string;
  ago: string;
  today: boolean;
  unread: boolean;
}

export const NOTIFICATIONS: Notification[] = [
  { id: 'n1', kind: 'payment', who: 'Sarah & Tom', what: 'paid their deposit', detail: '$1,500 · Invoice 0142', ago: '12m', today: true, unread: true },
  { id: 'n2', kind: 'booking', who: 'Priya Shah', what: 'booked an Intro call', detail: 'Today, 3:15pm · 15 min', ago: '1h', today: true, unread: true },
  { id: 'n3', kind: 'comment', who: 'Ella & Noah', what: 'commented on the seating plan', detail: '"Can we move Grandma nearer the front?"', ago: '3h', today: true, unread: true },
  { id: 'n4', kind: 'signed', who: 'Grace & Sam', what: 'signed their contract', detail: 'Full planning · Sun 2 May 2027', ago: '1d', today: false, unread: false },
  { id: 'n5', kind: 'deadline', who: 'Final numbers', what: 'due to caterer on Friday', detail: 'Ella & Noah · Hawthorn Hall', ago: '2d', today: false, unread: false },
];

/**
 * A calendar event. `day` is relative to today, so the demo always has
 * something on. `booked` events came in through a booking page or are
 * events (green dot); the MC's own are grey.
 */
export interface CalendarEvent {
  day: number;
  time: string;
  title: string;
  detail: string;
  booked: boolean;
}

export const EVENTS: CalendarEvent[] = [
  { day: -3, time: '4:00pm', title: 'Menu tasting with Grace & Sam', detail: 'In person', booked: false },
  { day: 0, time: '11:00am', title: 'Call with Ella & Noah', detail: 'Planning check-in · Video', booked: false },
  { day: 0, time: '3:15pm', title: 'Intro call with Priya Shah', detail: 'Booked via Intro call', booked: true },
  { day: 2, time: '2:30pm', title: 'Sarah & Tom', detail: 'Event · Stones of the Yarra Valley', booked: true },
  { day: 4, time: '6:00pm', title: 'Venue walkthrough', detail: 'The Boathouse · In person', booked: false },
  { day: 7, time: '10:00am', title: 'Intro call with Mia & Leo', detail: 'Booked via Intro call', booked: true },
];

/** The MC's public booking page. */
export const BOOKING_URL = 'zebri.com/arjun';

/** A kind of meeting clients can book. */
export interface BookingType {
  slug: string;
  name: string;
  detail: string;
  live: boolean;
}

export const BOOKING_TYPES: BookingType[] = [
  { slug: 'intro', name: 'Intro call', detail: '15 min · Video call', live: true },
  { slug: 'planning', name: 'Planning consultation', detail: '45 min · Video call', live: true },
  { slug: 'walkthrough', name: 'Venue walkthrough', detail: '1 hr · In person', live: false },
];

/** The next event's run sheet: each moment, and whether it is confirmed. */
export interface RunSheetItem {
  time: string;
  moment: string;
  done: boolean;
}

export const RUN_SHEET: RunSheetItem[] = [
  { time: '2:30pm', moment: 'Ceremony', done: true },
  { time: '3:15pm', moment: 'Family photos', done: true },
  { time: '5:30pm', moment: 'Guests seated', done: true },
  { time: '6:00pm', moment: 'Bridal party entrance', done: true },
  { time: '7:15pm', moment: 'Speeches, order to confirm', done: false },
  { time: '8:30pm', moment: 'First dance, song missing', done: false },
];


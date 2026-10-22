/**
 * Made-up content behind the dashboard's clickable parts: the drafted
 * replies and the top-right lists. Kept apart from `demo-data.ts` so each file stays small.
 *
 * @module app/design-system/v2/pages/dashboard/demo-activity
 */

/** Zebri's drafted reply to each waiting message, keyed by sender. */
export const DRAFTS: Record<string, string> = {
  'Sarah Bennett':
    "Of course! I'll move Tom's sister's reading ahead of the poem and update the run sheet so the celebrant has it too.",
  'Hannah Lee':
    'Family photos start right after the ceremony, at 3:15 pm on the lawn. I will call the groups in order so nobody wanders off.',
};

/** Where an enquiry came in. A directory enquiry names the directory in `directory`. */
export type EnquirySource = 'Email' | 'Instagram' | 'Website' | 'Directory';

/** A new enquiry, newest first. `unread` until the MC opens it. */
export interface Enquiry {
  id: string;
  client: string;
  date: string;
  venue: string;
  guests: number;
  message: string;
  source: EnquirySource;
  /** The directory it came through (Easy Weddings), for `source: 'Directory'`. */
  directory?: string | undefined;
  /** Where a reply goes: an email address, or an Instagram handle for a DM. */
  contact: string;
  ago: string;
  unread: boolean;
}

export const ENQUIRIES: Enquiry[] = [
  { id: 'e1', client: 'Mia & Leo', date: 'Sat 14 Mar 2027', venue: 'Hawthorn Hall', guests: 120, message: 'Loved your reel from Hawthorn Hall. Are you free for our date?', source: 'Instagram', contact: '@mia.and.leo', ago: '1h', unread: true },
  { id: 'e2', client: 'Ella & Noah', date: 'Sat 6 Feb 2027', venue: 'Curzon Hall', guests: 80, message: 'Hi! A friend recommended you. Could we get a quote?', source: 'Email', contact: 'ella.noah@gmail.com', ago: '2d', unread: true },
  { id: 'e3', client: 'Grace & Sam', date: 'Sun 2 May 2027', venue: 'The Grainery', guests: 150, message: 'Looking for on-the-day coordination at The Grainery.', source: 'Website', contact: 'grace.sam@outlook.com', ago: '3d', unread: false },
  { id: 'e4', client: 'Priya & Dev', date: 'Sat 19 Jun 2027', venue: 'The Grain Store', guests: 200, message: 'Two-day celebration, ceremony and reception across both days.', source: 'Website', contact: 'priya.dev@gmail.com', ago: '5d', unread: false },
  { id: 'e5', client: 'Lucy & Oscar', date: 'Sat 20 Nov 2027', venue: 'Stones of the Yarra Valley', guests: 110, message: 'We would love an MC who keeps the night moving. What are your packages?', source: 'Directory', directory: 'Easy Weddings', contact: 'lucy.oscar@gmail.com', ago: '6d', unread: false },
];

/** What a notification is about, which sets its icon and tint. */
export type NotificationKind = 'payment' | 'booking' | 'comment' | 'signed' | 'deadline' | 'registry';

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
  { id: 'n2', kind: 'booking', who: 'Priya Shah', what: 'booked an Intro call', detail: 'Today, 3:15 pm · 15 min', ago: '1h', today: true, unread: true },
  { id: 'n3', kind: 'comment', who: 'Ella & Noah', what: 'commented on the seating plan', detail: '"Can we move Grandma nearer the front?"', ago: '3h', today: true, unread: true },
  { id: 'n4', kind: 'signed', who: 'Grace & Sam', what: 'signed their contract', detail: 'Full planning · Sun 2 May 2027', ago: '1d', today: false, unread: false },
  { id: 'n5', kind: 'deadline', who: 'Final numbers', what: 'due to caterer on Friday', detail: 'Ella & Noah · Hawthorn Hall', ago: '2d', today: false, unread: false },
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

const AGO_UNITS: Record<string, string> = { m: 'minute', h: 'hour', d: 'day', w: 'week' };

/**
 * A short `ago` ("12m", "1h", "2d") spelled out the way the product
 * writes relative times: "12 minutes ago", "1 hour ago", "2 days ago".
 * Anything else ("just now") is shown as it is.
 */
export function agoText(ago: string): string {
  const m = /^(\d+)([mhdw])$/.exec(ago.trim());
  if (!m) return ago;
  const n = Number(m[1]);
  return `${n} ${AGO_UNITS[m[2]!]}${n === 1 ? '' : 's'} ago`;
}

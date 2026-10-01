import { Blocks, type LucideIcon } from 'lucide-react';

/**
 * Made-up content for the v2 dashboard preview. Nothing here is read
 * from the database; the real page will fill the same shapes.
 *
 * @module app/design-system/v2/pages/dashboard/demo-data
 */

/**
 * One sidebar destination. Which ones show comes from what is added in
 * Blocks (`sidebarItems` in `blocks/use-blocks.ts`).
 */
export interface NavItem {
  label: string;
  icon: LucideIcon;
  /** Shown but not yet open: a new account's pages before setup reaches them. */
  locked?: boolean | undefined;
}

/** Pinned to the foot of the sidebar, above the user. */
export const BLOCKS: NavItem = { label: 'Blocks', icon: Blocks };

/** Earlier conversations with Zebri, grouped by when, newest first. */
export const HISTORY: { group: string; items: string[] }[] = [
  { group: 'Today', items: ["Sarah & Tom's run sheet", 'Reply to Ella & Noah'] },
  { group: 'This week', items: ['Vows for Priya & James', 'September invoices'] },
];

/** Who the "Ask Zebri" box can be scoped to. The first is the default. */
export const SCOPES = ['All clients', 'Sarah & Tom', 'Ella & Noah', 'Priya & James'];

/** The signed-in MC. */
export const DEMO_USER = { firstName: 'Arjun', name: 'Arjun Punekar' };

/**
 * The next event. `daysAway` and `startsAt` (24h "HH:MM") keep the
 * demo two days out whenever it is opened; see {@link nextEventAt}.
 */
export const NEXT_EVENT = {
  client: 'Sarah & Tom',
  daysAway: 2,
  startsAt: '14:30',
};

/** One client message waiting on the MC. */
export interface Message {
  from: string;
  preview: string;
  ago: string;
}

/** Messages waiting on a reply, newest first. */
export const NEEDS_REPLY: Message[] = [
  { from: 'Sarah Bennett', preview: 'Can we swap the reading order?', ago: '2h' },
  { from: 'Hannah Lee', preview: 'What time are the family photos?', ago: '5h' },
];

/** Events booked this calendar month, and whether that beats every earlier year's same month. */
export const BOOKED_THIS_MONTH = { count: 3, bestYet: true };

/**
 * A booking at risk: a held date with no signed contract that another
 * client has now asked about. `id` is theirs on the Clients page. `null`
 * when there is none.
 */
export const AT_RISK: { id: string; client: string; reason: string } | null = {
  id: 'priya-james',
  client: 'Priya & James',
  reason: "haven't signed, and another client wants their date.",
};


/** When the demo event starts, relative to `now`. */
export function nextEventAt(now: Date): Date {
  const [h = 0, m = 0] = NEXT_EVENT.startsAt.split(':').map(Number);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + NEXT_EVENT.daysAway, h, m);
}

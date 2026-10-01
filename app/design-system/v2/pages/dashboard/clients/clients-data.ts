import type { BadgeTone } from '@/components/ui-v2/badge';

/**
 * Made-up clients for the v2 Clients page. Nothing is read from the
 * database; the real page fills the same shapes. Every client has a
 * stage on the booking path, a heat Zebri has read from their activity,
 * one line of why, and at most one next move.
 *
 * @module app/design-system/v2/pages/dashboard/clients/clients-data
 */

/** The booking path, in order. The track on each row draws these. */
export const STAGES = [
  'Enquiry',
  'Contacted',
  'Call',
  'Proposal',
  'Booked',
  'Planning',
  'Event',
] as const;
export type Stage = (typeof STAGES)[number];

/** From Booked on, a client is booked rather than a lead. */
export const BOOKED_FROM = STAGES.indexOf('Booked');

/** Zebri's read of how a client is going. */
export type Heat = 'New' | 'Hot' | 'Warm' | 'Cooling' | 'Clash' | 'Booked' | 'On track';

/** How each heat reads as a badge: colour only where it asks for attention. */
export const HEAT_TONE: Record<Heat, BadgeTone> = {
  New: 'brand',
  Hot: 'danger',
  Warm: 'warning',
  Cooling: 'neutral',
  Clash: 'warning',
  Booked: 'brand',
  'On track': 'brand',
};

/** The For you sections, most urgent first. */
export type Group = 'needs' | 'hot' | 'warm' | 'calm';

export const GROUPS: { id: Group; title: string; note: string; dot: string }[] = [
  { id: 'needs', title: 'Needs you', note: 'Zebri has drafted the next step', dot: 'bg-danger' },
  { id: 'hot', title: 'Hot', note: 'Likely to book soon', dot: 'bg-warning' },
  { id: 'warm', title: 'Warm', note: 'Moving, nothing due from you', dot: 'bg-zebra-300' },
  { id: 'calm', title: 'On track', note: 'Booked and ticking along', dot: 'bg-grass-500' },
];

/** One client (a client). */
export interface Client {
  id: string;
  /** The two first names, e.g. ["Amelia", "Jack"]. */
  names: [string, string];
  date: string;
  venue: string;
  stage: Stage;
  /** How long they have sat in the stage, or how far off the event is. */
  since: string;
  heat: Heat;
  /** Zebri's one-line read of what is going on. */
  read: string;
  /** The one thing to do next; `null` when nothing is due. */
  move: string | null;
  group: Group;
  /** Their email, for an account that collected it (a new account's clients); the demo's are made up from their names. */
  email?: string | undefined;
}

/** A client's display name, "Amelia & Jack", or "Priya" for one person (no second name). */
export const clientName = (c: Client) => (c.names[1] ? `${c.names[0]} & ${c.names[1]}` : c.names[0]);

export const CLIENTS: Client[] = [
  {
    id: 'amelia-jack',
    names: ['Amelia', 'Jack'],
    date: 'Sat 10 Oct 2026',
    venue: 'Hawthorn Hall',
    stage: 'Planning',
    since: 'In 15 days',
    heat: 'Booked',
    read: "Final numbers are due to the caterer Friday and they haven't confirmed. Reminder drafted.",
    move: 'Send reminder',
    group: 'needs',
  },
  {
    id: 'ella-noah',
    names: ['Ella', 'Noah'],
    date: 'Sat 6 Feb 2027',
    venue: 'Curzon Hall',
    stage: 'Contacted',
    since: 'Quiet 3 days',
    heat: 'Cooling',
    read: 'No reply to your quote since Tuesday. A light nudge usually lands the same day.',
    move: 'Send nudge',
    group: 'needs',
  },
  {
    id: 'mia-leo',
    names: ['Mia', 'Leo'],
    date: 'Sat 14 Mar 2027',
    venue: 'Hawthorn Hall',
    stage: 'Enquiry',
    since: 'Enquired 1h ago',
    heat: 'New',
    read: "You're free on 14 March. A reply with your intro call link is drafted.",
    move: 'Send reply',
    group: 'needs',
  },
  {
    id: 'zoe-liam',
    names: ['Zoe', 'Liam'],
    date: 'Sat 31 Oct 2026',
    venue: 'Centennial Homestead',
    stage: 'Planning',
    since: 'In 36 days',
    heat: 'Booked',
    read: "Run sheet hasn't been approved and suppliers need it 3 weeks out.",
    move: 'Ask to approve',
    group: 'needs',
  },
  {
    id: 'priya-dev',
    names: ['Priya', 'Dev'],
    date: 'Sat 19 Jun 2027',
    venue: 'The Grain Store',
    stage: 'Enquiry',
    since: 'Enquired 2d ago',
    heat: 'Clash',
    read: 'You already have an event on 19 June. Refer them to someone you trust, or decline kindly.',
    move: 'Refer or decline',
    group: 'needs',
  },
  {
    id: 'priya-james',
    names: ['Priya', 'James'],
    date: 'Sat 14 Mar 2027',
    venue: 'The Boathouse Palm Beach',
    stage: 'Proposal',
    since: 'Accepted 12 days ago',
    heat: 'Clash',
    read: "Accepted your proposal 12 days ago but the contract isn't signed. Mia & Leo asked about the same date an hour ago.",
    move: 'Send contract reminder',
    group: 'needs',
  },
  {
    id: 'sophie-max',
    names: ['Sophie', 'Max'],
    date: 'Sat 21 Nov 2026',
    venue: 'Curzon Hall',
    stage: 'Proposal',
    since: 'Proposal day 2',
    heat: 'Hot',
    read: 'Opened your proposal 3 times today and lingered on the premium package.',
    move: 'Call Sophie',
    group: 'hot',
  },
  {
    id: 'grace-sam',
    names: ['Grace', 'Sam'],
    date: 'Sun 2 May 2027',
    venue: 'Bells at Killcare',
    stage: 'Call',
    since: 'Call Tue 6pm',
    heat: 'Hot',
    read: 'Asked about payment plans in their last email. Proposal ready to send after the call.',
    move: 'Prep call notes',
    group: 'hot',
  },
  {
    id: 'olivia-ben',
    names: ['Olivia', 'Ben'],
    date: 'Sat 27 Feb 2027',
    venue: 'Establishment Ballroom',
    stage: 'Proposal',
    since: 'Proposal day 5',
    heat: 'Warm',
    read: "Replies fast but hasn't opened the proposal. Emails may be landing in spam.",
    move: 'Resend via DM',
    group: 'warm',
  },
  {
    id: 'jess-ali',
    names: ['Jess', 'Ali'],
    date: 'Sat 10 Apr 2027',
    venue: 'Gunners Barracks',
    stage: 'Contacted',
    since: 'Replied yesterday',
    heat: 'Warm',
    read: 'Viewed your packages page twice. Waiting on a date with their venue.',
    move: null,
    group: 'warm',
  },
  {
    id: 'hannah-joe',
    names: ['Hannah', 'Joe'],
    date: 'Sat 23 Jan 2027',
    venue: 'Stones of the Yarra Valley',
    stage: 'Contacted',
    since: 'Quiet 9 days',
    heat: 'Cooling',
    read: 'Said they were comparing MCs. Zebri will check in once more next week.',
    move: 'Check in now',
    group: 'warm',
  },
  {
    id: 'isla-ethan',
    names: ['Isla', 'Ethan'],
    date: 'Sat 6 Mar 2027',
    venue: 'Quarantine Station',
    stage: 'Planning',
    since: 'In 5 months',
    heat: 'On track',
    read: 'Deposit paid, questionnaire done. Next milestone is the run sheet in January.',
    move: null,
    group: 'calm',
  },
  {
    id: 'chloe-marcus',
    names: ['Chloe', 'Marcus'],
    date: 'Sat 12 Dec 2026',
    venue: 'Doltone House',
    stage: 'Booked',
    since: 'Booked 2 weeks ago',
    heat: 'On track',
    read: 'Contract signed and first instalment paid on time.',
    move: null,
    group: 'calm',
  },
];

/** The Everyone / Leads / Booked scope. */
export type Scope = 'Everyone' | 'Leads' | 'Booked';
export const SCOPES = ['Everyone', 'Leads', 'Booked'] as const;

export const inScope = (c: Client, scope: Scope) =>
  scope === 'Everyone' || (scope === 'Booked') === STAGES.indexOf(c.stage) >= BOOKED_FROM;

/** Every heat, in the order the filter lists them. */
export const HEATS: Heat[] = ['New', 'Hot', 'Warm', 'Cooling', 'Clash', 'Booked', 'On track'];

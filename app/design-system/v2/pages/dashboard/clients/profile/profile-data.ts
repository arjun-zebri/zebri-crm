import { BOOKED_FROM, STAGES, type Client } from '../clients-data';

import { AMELIA_JACK } from './amelia-jack';

/**
 * The shapes behind a client's profile, and {@link profileFor}, which
 * builds one for any demo client. Amelia & Jack have a hand-written
 * profile (`amelia-jack.ts`) with every part filled in; every other
 * client gets one made from their row on the Clients page. The event's
 * type ("Wedding", "Birthday") and people's roles are data, so nothing
 * in the components assumes a kind of event.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/profile-data
 */

/** A message Zebri has drafted for the MC to review and send. */
export interface Draft {
  channel: 'Email' | 'WhatsApp';
  /** First name of who it goes to. */
  to: string;
  subject?: string | undefined;
  body: string;
}

/** How much a waiting task matters: overdue (red) or waiting on someone (amber). */
export type Tone = 'danger' | 'warning';

/**
 * Something the MC has to do today: a short name ("Guest count"), where
 * it stands ("Overdue · venue needs it Fri"), and the one button that
 * does it ("Ask Amelia"), which opens the message Zebri drafted.
 */
export interface Task {
  id: string;
  label: string;
  status: string;
  tone: Tone;
  cta: string;
  draft: Draft;
  /** How it reads in Activity once sent. */
  done: string;
}

/**
 * A date ahead, before the event: a short day ("Tue 29"), what happens,
 * and whether Zebri sends it on its own.
 */
export interface Upcoming {
  id: string;
  when: string;
  label: string;
  zebri?: boolean | undefined;
}

/** The event everything leads to, shown in the header and at the timeline's end. */
export interface EventInfo {
  /** "Wedding", "Birthday", "Event". */
  type: string;
  /** "Sat 10 Oct". */
  date: string;
  /** "Sat 10": the timeline's short form. */
  day: string;
  /** "2:30pm", or empty when not set. */
  time: string;
  venue: string;
}

/** A labelled fact in the Details column. `tone` colours a value that needs attention. */
export interface Fact {
  label: string;
  value: string;
  tone?: Tone | undefined;
}

/**
 * What an activity is about, which picks its mark and its filter: a
 * message from someone (their initial), money in ($), a document sent,
 * signed or filled in (an arrow), something Zebri did on its own (Z), or
 * a video call (a camera).
 */
export type ActivityKind = 'message' | 'payment' | 'document' | 'zebri' | 'call';

/**
 * One thing that happened. The row reads "**who** text" over a short
 * line of what matters (`sub`); selecting it shows the rest in the panel
 * beside the list.
 */
export interface Activity {
  id: string;
  kind: ActivityKind;
  /** Who did it, bold at the start of the row: "Jack", "You", "Payment". */
  who: string;
  /** What they did, following `who`. */
  text: string;
  sub: string;
  /** Short: "Thu", "20 Sep". */
  time: string;
  /** A message's initial on green (the main client) instead of grey. */
  lead?: boolean | undefined;
  /** Above the panel's title: what kind of thing and when ("Automation · Thu"). */
  about: string;
  /** The panel's title, as a full sentence. */
  title: string;
  body: string;
  /** The panel's one button, when there is something to do about it. */
  action?: string | undefined;
}

/** A run of activity under one heading: "This week", "March". */
export interface ActivityGroup {
  title: string;
  items: Activity[];
}

/** The kind of file a document is, shown on its tile. */
export type FileType = 'PDF' | 'INV' | 'FORM' | 'XLS';

/**
 * Where a document stands: waiting on someone (amber), set to go out
 * (green), finished (a green dot), or received from someone else (grey).
 */
export type DocStatus = 'waiting' | 'scheduled' | 'done' | 'received';

/** A document on the Documents list. */
export interface Doc {
  id: string;
  type: FileType;
  title: string;
  /** Under the title: who it went to, what it is for, the amount. */
  sub: string;
  status: DocStatus;
  /** The status in words: "Not opened", "Paid". */
  state: string;
  /** Short: "22 Sep". */
  date: string;
  /** Still moving, finished, or shared by someone else. */
  group: 'progress' | 'complete' | 'shared';
  /** The panel's label and value rows: Sent, To, Opened, Needs. */
  facts: Fact[];
  /** The panel's main button beside Download, when there is something to do. */
  action?: string | undefined;
}

export interface Person {
  name: string;
  /** Who they are to the event: "Bride", "Venue coordinator". */
  role: string;
  /** How they like to be reached, in a word or two. */
  prefers: string;
  email: string;
  phone: string;
}

export interface Profile {
  event: EventInfo;
  /** What needs the MC today, most urgent first. */
  today: Task[];
  /** Dates ahead before the event, soonest first. */
  upcoming: Upcoming[];
  facts: Fact[];
  people: Person[];
  notes: string;
  /** Newest first. */
  activity: ActivityGroup[];
  /** Activity's "At a glance": how the client talks to the MC. */
  glance: Fact[];
  docs: Doc[];
}

/** A client's profile: the hand-written one, or one built from their row. */
export function profileFor(c: Client): Profile {
  if (c.id === 'amelia-jack') return AMELIA_JACK;
  const [a, b] = c.names;
  const booked = STAGES.indexOf(c.stage) >= BOOKED_FROM;
  const email = (n: string) => `${n.toLowerCase()}@example.com`;
  // "Sat 6 Feb 2027" → "Sat 6 Feb" for the header, "Sat 6" for the timeline.
  const [dow = '', dom = '', month = ''] = c.date.split(' ');
  const [head] = c.read.split('. ');
  return {
    event: {
      type: 'Event',
      date: `${dow} ${dom} ${month}`,
      day: `${dow} ${dom}`,
      time: '',
      venue: c.venue,
    },
    today: c.move
      ? [
          {
            id: 'move',
            label: head?.replace(/\.$/, '') ?? c.move,
            status: c.since,
            tone: c.heat === 'Cooling' || c.heat === 'Clash' ? 'danger' : 'warning',
            cta: c.move,
            done: `${c.move}: sent`,
            draft: {
              channel: 'Email',
              to: a,
              subject: `Your event on ${c.date}`,
              body: draftFor(c),
            },
          },
        ]
      : [],
    upcoming: booked
      ? [{ id: 'balance', when: 'Before', label: '$1,450 due' }]
      : [{ id: 'book', when: 'Next', label: 'Contract and deposit' }],
    facts: [
      { label: 'Date', value: c.date },
      { label: 'Venue', value: c.venue },
      { label: 'Package', value: booked ? 'Classic · $2,900' : 'Not chosen' },
      ...(booked ? [{ label: 'Paid', value: '$1,450 · $1,450 due' }] : []),
      { label: 'Source', value: 'Website form' },
    ],
    people: [
      { name: a, role: 'Client', prefers: 'email', email: email(a), phone: '0400 000 000' },
      {
        name: b,
        role: 'Client',
        prefers: 'no preference yet',
        email: email(b),
        phone: '0400 000 001',
      },
    ],
    notes: '',
    activity: [
      {
        title: 'This week',
        items: [
          {
            id: 'read',
            kind: 'zebri',
            who: 'Zebri',
            text: 'read their latest activity',
            sub: head ?? c.read,
            time: c.since,
            about: `Zebri · ${c.since}`,
            title: 'Zebri read their latest activity',
            body: c.read,
            action: c.move || undefined,
          },
        ],
      },
    ],
    glance: [
      { label: 'Last heard from', value: `${a} · ${c.since}` },
      { label: `${a} replies`, value: 'Not enough yet to tell' },
    ],
    docs: booked
      ? [
          {
            id: 'contract',
            type: 'PDF',
            title: 'Contract',
            sub: 'Classic package · $2,900',
            status: 'done',
            state: 'Signed',
            date: 'Apr',
            group: 'complete',
            facts: [{ label: 'Signed', value: `${a} and ${b}` }],
          },
          {
            id: 'deposit',
            type: 'INV',
            title: 'Deposit',
            sub: '$1,450',
            status: 'done',
            state: 'Paid',
            date: 'Apr',
            group: 'complete',
            facts: [{ label: 'Paid', value: 'By card, through the portal' }],
          },
        ]
      : [
          {
            id: 'proposal',
            type: 'PDF',
            title: 'Proposal',
            sub: `Sent to ${a}`,
            status: 'waiting',
            state: c.stage === 'Proposal' ? 'Not accepted' : 'Not sent',
            date: 'This week',
            group: 'progress',
            facts: [{ label: 'To', value: `${a} and ${b}` }],
            action: c.move || undefined,
          },
        ],
  };
}

/** A plain first draft for a client without a hand-written profile, by stage. */
function draftFor(c: Client): string {
  const [a, b] = c.names;
  const body =
    c.move === 'Send contract reminder'
      ? `Just a gentle nudge on the contract. Your date is still held for you, but I've had another enquiry for it, so I'd love to lock it in this week. It only takes a minute to sign: zebri.app/sign/${c.id}`
      : c.stage === 'Enquiry'
      ? "Thanks so much for getting in touch! I'd love to hear more about your plans. Here's a link to book a quick intro call: zebri.app/arjun/intro"
      : `Just checking in on where you've landed. Happy to jump on a quick call if that's easier.`;
  return `Hi ${a} and ${b},\n\n${body}\n\nWarmly,\nArjun`;
}

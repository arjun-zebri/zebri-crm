import type { Client } from '../clients-data';

import { AMELIA_JACK_CALLS } from './amelia-jack-calls';
import type { Draft, Person, Profile } from './profile-data';

/**
 * The shapes behind the profile's Calls section, the demo calls for any
 * client ({@link callsFor}), and {@link applyCalls}, which folds the
 * updates the MC applied from a call's notes back into the profile, so
 * the Overview's details and today's tasks change with them.
 *
 * A call goes upcoming, then live (held in `useCalls`, not here), then
 * processing while Zebri writes the notes, then ready.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/calls-data
 */

/** One line of a call's transcript. `at` is how far into the call ("05:30"). */
export interface TranscriptLine {
  id: string;
  at: string;
  who: string;
  /** Said by the MC, which sets the speaker apart. */
  you?: boolean | undefined;
  text: string;
}

/** What the MC did with a suggested update. */
export type Verdict = 'applied' | 'dismissed';

/**
 * A change to the client's record Zebri heard on the call: a Details fact
 * from one value to another, or a new person. Nothing changes until the
 * MC applies it.
 */
export interface CallUpdate {
  id: string;
  /** The Details label it changes ("Guests"), or "People" for a new person. */
  label: string;
  /** The value now; empty when it was never set. */
  from: string;
  to: string;
  /** Adds this person to People instead of changing a fact. */
  person?: Person | undefined;
  /** The transcript line it was heard in, and the words themselves. */
  line: string;
  quote: string;
  /** Today's task it settles: applying it takes the task off the Overview. */
  resolves?: string | undefined;
  /** A date on the Overview timeline it rewrites, by id. */
  upcoming?: { id: string; label: string } | undefined;
  /** Already decided before this visit (an older call). */
  decided?: Verdict | undefined;
}

/** Something worth keeping that has no field of its own, with the line it came from. */
export interface KeyDetail {
  text: string;
  line: string;
}

/** What Zebri writes after a call. */
export interface CallNotes {
  /** Two or three sentences: what changed. */
  summary: string;
  updates: CallUpdate[];
  details: KeyDetail[];
  /** A recap to the client, drafted, never sent on its own. */
  followUp: Draft;
  /** The recap went out before this visit. */
  followUpSent?: boolean | undefined;
  transcript: TranscriptLine[];
  /** The checklist as the call ended: ticked, and not. */
  covered: string[];
  missed: string[];
  /** What the MC jotted during the call, kept word for word. */
  scratch?: string | undefined;
}

export type CallStatus = 'upcoming' | 'processing' | 'ready';

export interface Call {
  id: string;
  title: string;
  /** "Today, 4:00pm", "Thu 12 Feb". */
  when: string;
  /** "38 min", once it has happened. */
  length?: string | undefined;
  status: CallStatus;
  notes?: CallNotes | undefined;
  /** Ended in this visit, so Activity lists it at the top. */
  fresh?: boolean | undefined;
}

/** A client's calls, the checklist for the next one, and the notes the next call makes (demo). */
export interface CallsSeed {
  calls: Call[];
  checklist: string[];
  next: Omit<CallNotes, 'covered' | 'missed' | 'scratch'>;
  /** How long the demo's next call runs. */
  nextLength: string;
}

/** The hand-written calls, or a plain set made from the client's row. */
export function callsFor(c: Client): CallsSeed {
  if (c.id === 'amelia-jack') return AMELIA_JACK_CALLS;
  const [a, b] = c.names;
  const l = (id: string, at: string, who: string, text: string, you?: boolean) => ({ id, at, who, text, you });
  return {
    calls: [],
    checklist: ['Date and venue', 'Guest count', 'The feel of the day', 'Budget'],
    nextLength: '24 min',
    next: {
      summary: `${a} and ${b} want a relaxed day with a full dance floor, around 120 guests. They are weighing up two packages and want to decide this week.`,
      updates: [
        { id: 'guests', label: 'Guests', from: '', to: '120', line: 'g3', quote: 'Around 120, give or take.' },
      ],
      details: [{ text: 'Relaxed, big dance floor, no formal first dance.', line: 'g5' }],
      followUp: {
        channel: 'Email',
        to: a,
        subject: 'Great to chat today',
        body: `Hi ${a} and ${b},\n\nLovely to talk today. Here is what I heard: around 120 guests, a relaxed day with a full dance floor, and no formal first dance.\n\nI've attached both packages so you can compare them side by side.\n\nWarmly,\nArjun`,
      },
      transcript: [
        l('g1', '00:10', 'You', `Hi ${a}, hi ${b}! Thanks for making the time.`, true),
        l('g2', '00:42', 'You', 'Roughly how many are you expecting?', true),
        l('g3', '00:49', a, 'Around 120, give or take.'),
        l('g4', '01:30', 'You', 'And how do you want the day to feel?', true),
        l('g5', '01:38', b, 'Relaxed. Big dance floor. No formal first dance.'),
      ],
    },
  };
}

/**
 * The profile with the applied updates folded in: facts replaced (and
 * no longer coloured as a problem), new people added, settled tasks
 * dropped from today, timeline dates rewritten, and calls ended this
 * visit at the top of Activity. Updates decided on an older call are
 * already part of the profile, so they are skipped.
 */
export function applyCalls(base: Profile, calls: Call[], decisions: Record<string, Verdict>): Profile {
  const applied = calls
    .flatMap((c) => c.notes?.updates ?? [])
    .filter((u) => !u.decided && decisions[u.id] === 'applied');
  let facts = base.facts;
  const people = [...base.people];
  for (const u of applied) {
    if (u.person) people.push(u.person);
    else if (facts.some((f) => f.label === u.label))
      facts = facts.map((f) => (f.label === u.label ? { label: f.label, value: u.to } : f));
    else facts = [...facts, { label: u.label, value: u.to }];
  }
  const resolved = new Set(applied.map((u) => u.resolves).filter(Boolean));
  const rewrites = new Map(applied.flatMap((u) => (u.upcoming ? [[u.upcoming.id, u.upcoming.label]] : [])));
  const fresh = calls.filter((c) => c.fresh && c.status !== 'upcoming');
  const [first, ...rest] = base.activity;
  const callItems = fresh.map((c) => ({
    id: `activity-${c.id}`,
    kind: 'call' as const,
    who: 'You',
    text: `had a ${c.title.toLowerCase()}`,
    sub: c.status === 'ready' ? (c.notes?.summary.split('. ')[0] ?? '') : 'Zebri is writing the notes',
    time: 'Today',
    about: `Call · Today · ${c.length ?? ''}`,
    title: `You had a ${c.title.toLowerCase()} with them`,
    body: c.notes?.summary ?? '',
    action: 'Open notes',
  }));
  return {
    ...base,
    facts,
    people,
    today: base.today.filter((t) => !resolved.has(t.id)),
    upcoming: base.upcoming.map((u) => ({ ...u, label: rewrites.get(u.id) ?? u.label })),
    activity: first ? [{ ...first, items: [...callItems, ...first.items] }, ...rest] : base.activity,
  };
}

/** How many suggested updates still wait on the MC, across every call. */
export function pendingUpdates(calls: Call[], decisions: Record<string, Verdict>): number {
  return calls
    .filter((c) => c.status === 'ready')
    .flatMap((c) => c.notes?.updates ?? [])
    .filter((u) => !u.decided && !decisions[u.id]).length;
}

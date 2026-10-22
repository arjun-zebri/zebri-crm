import type { RowSection } from '@/components/ui-v2/row-sections';

import { WAIT_DOT } from './line-rules';

/**
 * Journeys' Up next: what the journeys will do for which client, and
 * when, with what waits on the MC first. Each row is one client at one
 * step of one journey (the demo journeys and couples in `journeys-data`
 * and `journeys-people`): a send held for the MC's OK (a step Sent
 * by "You, after approving", or one sent by hand), one of the MC's to-dos (a to-do
 * step, or a "Tell me after" follow-up coming due), then what Zebri
 * sends by itself today and later, and what is done. "Today" is the
 * Payments demo's, Sun 27 Sep 2026. All demo data.
 *
 * Moved here from the Workflows page's Up next tab when Workflows was
 * removed (2026-10-14): it was the one thing Workflows had that
 * Journeys did not.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/up-next-data
 */

/** Where a row is in its life: waiting on the MC, Zebri's to send, or done. */
export type QueueSection = 'approve' | 'todo' | 'today' | 'later' | 'done';

/** Where a row is shown: everything waiting on the MC sits in one section. */
export type QueueGroup = 'action' | 'today' | 'later' | 'done';

/** The row's group. See {@link QueueGroup}. */
export const groupOf = (i: QueueItem): QueueGroup => (i.section === 'approve' || i.section === 'todo' ? 'action' : i.section);

/** Still waiting on the MC: a send to OK or a to-do, not yet settled. */
export const waitsOnYou = (i: QueueItem) => (i.section === 'approve' || i.section === 'todo') && !i.outcome;

// The line's own dots: amber Needs you, green Automatic, grey settled.
export const QUEUE_SECTIONS: RowSection<QueueGroup>[] = [
  { id: 'action', title: 'Needs you', dot: WAIT_DOT.you },
  { id: 'today', title: 'Zebri sends today', dot: WAIT_DOT.auto },
  { id: 'later', title: 'Zebri sends later', dot: WAIT_DOT.auto },
  { id: 'done', title: 'Done', dot: 'bg-zebra-300', shut: true },
];

export interface QueueItem {
  id: string;
  section: QueueSection;
  names: [string, string];
  /** The journey it comes from. */
  journey: string;
  /** The step on that journey. */
  step: string;
  /** For a follow-up: the reminder it is ("Remind them after 3 days"). */
  reminder?: string | undefined;
  /** What it is: "Run sheet", "Call to go over the night". */
  label: string;
  /** When, in one grammar: a day and a time when there is one. A held send keeps its planned time until sent. */
  when: string;
  /** Zebri's one line of why this is happening now. */
  why?: string | undefined;
  /** A send written for this client already; otherwise the step's own email, filled in. */
  draft?: { subject: string; body: string } | undefined;
  /** A to-do past its day. */
  late?: boolean | undefined;
  /** For done: what happened. */
  outcome?: string | undefined;
}

export const SEED_QUEUE: QueueItem[] = [
  {
    id: 'q1', section: 'approve', names: ['Hannah', 'Joe'], journey: 'full', step: 'run-sheet', label: 'Run sheet', when: 'Today 9:00 am',
    why: 'A week before their wedding. You asked to see it before it goes.',
    draft: { subject: 'Your run sheet is ready', body: 'Hi Hannah and Joe,\n\nHere is the first draft of your run sheet. I have kept the speeches together after mains, as you asked.\n\nHave a read and approve it on the page, or tell me what to change.' },
  },
  { id: 'q2', section: 'approve', names: ['Hannah', 'Leo'], journey: 'corporate', step: 'run-sheet', label: 'Event running order', when: 'Tomorrow 9:00 am', why: 'Five days before their event.' },
  { id: 'q3', section: 'todo', names: ['Jess', 'Ali'], journey: 'full', step: 'call', label: 'Call to go over the night', when: 'Today 3:00 pm', why: 'Ten days before their wedding.' },
  { id: 'q4', section: 'todo', names: ['Amelia', 'Jack'], journey: 'full', step: 'contract', reminder: 'Tell me after 1 week', label: 'Contract still not signed', when: 'Yesterday', late: true, why: 'Sent nine days ago, and reminded once.' },
  { id: 'q5', section: 'today', names: ['Sophie', 'Max'], journey: 'full', step: 'deposit', reminder: 'Remind them after 3 days', label: 'Deposit reminder', when: 'Today 4:15 pm', why: 'The deposit invoice went three days ago and is not paid.' },
  { id: 'q6', section: 'today', names: ['Ella', 'Noah'], journey: 'full', step: 'enquiry', label: 'Thanks for getting in touch', when: 'Today 6:00 pm', why: 'Their enquiry came in at 2:10 pm.' },
  { id: 'q7', section: 'later', names: ['Isla', 'Ethan'], journey: 'full', step: 'thanks', label: 'Thank you', when: 'Tomorrow 9:00 am', why: 'Two days after their wedding.' },
  { id: 'q8', section: 'later', names: ['Ruby', 'Kai'], journey: 'ceremony', step: 'questionnaire', reminder: 'Remind them after 1 week', label: 'Questionnaire reminder', when: 'Sat 3 Oct 9:00 am', why: 'Only if their questionnaire is still not back by then.' },
  { id: 'q9', section: 'done', names: ['Mia', 'Leo'], journey: 'full', step: 'proposal', reminder: 'Remind them after 3 days', label: 'Proposal reminder', when: 'Thu 24 Sep', outcome: 'Sent, opened Thursday' },
  { id: 'q10', section: 'done', names: ['Olivia', 'Ben'], journey: 'full', step: 'questionnaire', label: 'Questionnaire', when: 'Wed 23 Sep', outcome: 'Sent, opened twice' },
];

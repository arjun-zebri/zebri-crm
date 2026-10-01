import type { RowSection } from '@/components/ui-v2/row-sections';

/**
 * The Up next tab's demo queue: a late to-do first (so it leads Needs
 * your action), sends waiting for the MC's OK (each already written for
 * that client), the MC's own to-dos, then what
 * Zebri will send by itself, by when. "Today" is the Payments demo's,
 * Sun 27 Sep 2026. The real page fills the same shapes from
 * `workflow_steps` (see `lib/workflows/queue.ts`).
 *
 * @module app/design-system/v2/pages/dashboard/workflows/queue-data
 */

export type QueueSection = 'approve' | 'todo' | 'today' | 'week' | 'later' | 'done';

/**
 * Where a row is shown, which is coarser than its `section`: everything
 * waiting on the MC (a send to approve, a to-do) sits in one Needs your
 * action section, and Zebri's own sends split only into today and later.
 */
export type QueueGroup = 'action' | 'today' | 'later' | 'done';

/** The row's group. See {@link QueueGroup}. */
export const groupOf = (i: QueueItem): QueueGroup =>
  i.section === 'approve' || i.section === 'todo' ? 'action' : i.section === 'today' || i.section === 'done' ? i.section : 'later';

// One colour, one meaning: amber waits on the MC (a late one says so in
// red on its own row), green is Zebri's to send, grey is settled.
export const QUEUE_SECTIONS: RowSection<QueueGroup>[] = [
  { id: 'action', title: 'Needs your action', dot: 'bg-warning' },
  { id: 'today', title: 'Zebri sends today', dot: 'bg-grass-500' },
  { id: 'later', title: 'Zebri sends later', dot: 'bg-grass-500' },
  { id: 'done', title: 'Done', dot: 'bg-zebra-300', shut: true },
];

export interface QueueItem {
  id: string;
  section: QueueSection;
  names: [string, string];
  workflow: string;
  /** What it is: "Final payment reminder", "Call to plan the day". */
  label: string;
  /**
   * When, in one grammar everywhere: a day ("Today", "Tomorrow",
   * "Thu 1 Oct") and a time when there is one. For a send waiting on
   * approval it is when it was planned to go; it holds until sent.
   */
  when: string;
  /** Zebri's one line of why this is happening now. */
  why?: string | undefined;
  /** For a send: the message as written for this client. */
  draft?: { subject: string; body: string } | undefined;
  /** For a to-do: overdue by days. */
  late?: boolean | undefined;
  /** For done: what happened. */
  outcome?: string | undefined;
}

const sign = '\n\nSpeak soon,\nArjun';

export const SEED_QUEUE: QueueItem[] = [
  { id: 'q4', section: 'todo', names: ['Grace', 'Sam'], workflow: 'wf-booked', label: 'Read their questionnaire answers', when: '2 days late', late: true, why: 'They sent it back on Thursday. Their run sheet waits on it.' },
  {
    id: 'q1', section: 'approve', names: ['Ella', 'Noah'], workflow: 'wf-booked', label: 'Final payment reminder', when: 'Today 9:00am',
    why: '$1,650 is due Friday. They opened the invoice twice and haven\'t paid.',
    draft: { subject: 'Final payment reminder', body: `Hi Ella and Noah,\n\nThree weeks until Gunners Barracks! A quick reminder that the final $1,650 is due this Friday, 2 October. You can pay by card here: zebri.app/i/4821\n\nI saw Noah's note about the later ceremony start. I've already moved the run sheet to 4:30.${sign}` },
  },
  {
    id: 'q2', section: 'approve', names: ['Sophie', 'Max'], workflow: 'wf-enquiry', label: 'Following up your proposal', when: 'Today 10:00am',
    why: 'They opened the proposal 3 times and spent longest on Premium.',
    draft: { subject: 'Following up your proposal', body: `Hi Sophie and Max,\n\nJust checking the proposal came through okay. I noticed Premium might be the one. If the extra hour of reception hosting is the question, I'm happy to talk it through on a quick call.\n\nJanuary dates are filling fast, so I'll hold 16 January for you until Friday.${sign}` },
  },
  {
    id: 'q3', section: 'approve', names: ['Priya', 'James'], workflow: 'wf-booked', label: 'Run sheet draft', when: 'Tomorrow 9:00am',
    why: 'Six weeks before the wedding. Built from their questionnaire.',
    draft: { subject: 'Your run sheet, first draft', body: `Hi Priya and James,\n\nHere's the first draft of your run sheet for Doltone House, built from your questionnaire. I've kept the Sangeet performances together after mains, as you asked.\n\nHave a look and add notes straight onto it: zebri.app/r/7730${sign}` },
  },
  { id: 'q5', section: 'todo', names: ['Sarah', 'Tom'], workflow: 'wf-booked', label: 'Planning call', when: 'Today 3:00pm', why: 'Their last call before the wedding on Sat 10 Oct.' },
  { id: 'q6', section: 'todo', names: ['Amelia', 'Jack'], workflow: 'wf-fortnight', label: 'Confirm the sound check with the venue', when: 'Tomorrow', why: 'Their wedding is on Sat 3 Oct.' },
  { id: 'q7', section: 'today', names: ['Mia', 'Leo'], workflow: 'wf-enquiry', label: 'Thanks for getting in touch', when: 'Today 4:15pm', why: 'Their enquiry came in at 2:10pm.' },
  { id: 'q8', section: 'today', names: ['Olivia', 'Ben'], workflow: 'wf-booked', label: 'Questionnaire', when: 'Today 6:00pm', why: 'Booked on Friday. It goes two days after booking.' },
  { id: 'q9', section: 'week', names: ['Sarah', 'Tom'], workflow: 'wf-fortnight', label: 'Two weeks to go', when: 'Tomorrow 9:00am', why: 'Their wedding is on Sat 10 Oct.' },
  { id: 'q10', section: 'week', names: ['Amelia', 'Jack'], workflow: 'wf-fortnight', label: 'See you on the day', when: 'Thu 1 Oct 9:00am', why: 'Two days before their wedding.' },
  { id: 'q11', section: 'week', names: ['Olivia', 'Ben'], workflow: 'wf-booked', label: 'A gentle nudge on your questionnaire', when: 'Fri 2 Oct 9:00am', why: 'Only if their questionnaire is still not back by then.' },
  { id: 'q12', section: 'later', names: ['Ella', 'Noah'], workflow: 'wf-fortnight', label: 'Two weeks to go', when: 'Sat 3 Oct 9:00am', why: 'Their wedding is on Sat 17 Oct.' },
  { id: 'q13', section: 'later', names: ['Hana', 'Luca'], workflow: 'wf-after', label: 'Happy anniversary!', when: 'Sun 29 Aug 2027', why: 'One year after their wedding.' },
  { id: 'q14', section: 'done', names: ['Hana', 'Luca'], workflow: 'wf-after', label: 'Thank you both', when: 'Thu 24 Sep', outcome: 'Sent, opened Thursday' },
  { id: 'q15', section: 'done', names: ['Grace', 'Sam'], workflow: 'wf-booked', label: 'Welcome aboard!', when: 'Wed 23 Sep', outcome: 'Sent, opened twice' },
];

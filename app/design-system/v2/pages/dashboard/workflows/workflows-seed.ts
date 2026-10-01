import type { Enrolment, Workflow } from './model';

/**
 * Made-up workflows for the v2 preview, written the way an MC would set
 * them up: a reply to every enquiry, the booked-client journey, the
 * final fortnight, and after the day. The clients are the other demo
 * pages' couples. Emails are in the MC's own voice, with `{{…}}`
 * variables Zebri fills per client. Nothing is read from the database.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/workflows-seed
 */

const C: Record<string, Enrolment> = {
  sarah: { names: ['Sarah', 'Tom'], event: '2026-10-10', at: 3 },
  ella: { names: ['Ella', 'Noah'], event: '2026-10-17', at: 4 },
  priya: { names: ['Priya', 'James'], event: '2026-11-07', at: 5 },
  amelia: { names: ['Amelia', 'Jack'], event: '2026-10-03', at: 1 },
  grace: { names: ['Grace', 'Sam'], event: '2027-02-13', at: 2 },
  olivia: { names: ['Olivia', 'Ben'], event: '2027-03-20', at: 1 },
  sophie: { names: ['Sophie', 'Max'], event: '2027-01-16', at: 2 },
  mia: { names: ['Mia', 'Leo'], event: null, at: 1 },
  hana: { names: ['Hana', 'Luca'], event: '2026-08-29', at: 1 },
};

const sign = '\n\nSpeak soon,\nArjun';

export const SEED_WORKFLOWS: Workflow[] = [
  {
    id: 'wf-enquiry',
    name: 'New enquiry',
    on: true,
    trigger: { id: 'new_enquiry', filters: [] },
    sentThisWeek: 11,
    lastSent: '2h ago',
    clients: [C.mia!, C.sophie!, C.olivia!],
    steps: [
      { id: 'e1', kind: 'email', timing: { mode: 'after', n: 15, unit: 'minutes' }, approve: false, subject: 'Thanks for getting in touch', body: `Hi {{first names}},\n\nThanks so much for reaching out about {{event date}}. I'd love to hear more about the day you're planning.\n\nHere's a link to grab 20 minutes with me whenever suits: {{booking link}}${sign}` },
      { id: 'e2', kind: 'document', timing: { mode: 'after', n: 1, unit: 'days' }, doc: 'Proposal', approve: true },
      { id: 'e3', kind: 'if', timing: { mode: 'after', n: 3, unit: 'days' }, condition: "the proposal isn't accepted", then: [
        { id: 'e4', kind: 'email', timing: { mode: 'now' }, approve: true, subject: 'Following up your proposal', body: `Hi {{first names}},\n\nJust checking the proposal came through okay. Happy to jump on a call if anything needs a tweak, or if you'd like to mix and match packages.${sign}` },
        { id: 'e5', kind: 'todo', timing: { mode: 'after', n: 4, unit: 'days' }, title: 'Give them a call' },
      ] },
    ],
  },
  {
    id: 'wf-booked',
    name: 'Booked client',
    on: true,
    trigger: { id: 'proposal_accepted', filters: ['Weddings only'] },
    sentThisWeek: 6,
    lastSent: 'yesterday',
    issue: { text: '1 email bounced', who: 'Grace & Sam' },
    clients: [C.sarah!, C.ella!, C.priya!, C.grace!, C.sophie!],
    steps: [
      { id: 'b1', kind: 'email', timing: { mode: 'now' }, approve: false, subject: 'Welcome aboard!', body: `Hi {{first names}},\n\nI'm so excited to be part of {{event date}} at {{venue}}. Your contract and deposit invoice are on their way, and your planning portal is here: {{portal link}}${sign}` },
      { id: 'b2', kind: 'stage', timing: { mode: 'now' }, stage: 'Booked' },
      { id: 'b3', kind: 'document', timing: { mode: 'after', n: 2, unit: 'days' }, doc: 'Questionnaire', approve: false },
      { id: 'b4', kind: 'if', timing: { mode: 'after', n: 5, unit: 'days' }, condition: "the questionnaire isn't back", then: [
        { id: 'b5', kind: 'email', timing: { mode: 'now' }, approve: false, subject: 'A gentle nudge on your questionnaire', body: `Hi {{first names}},\n\nNo rush at all, but when you get a moment the questionnaire helps me get to know you both: {{questionnaire link}}${sign}` },
      ] },
      { id: 'b6', kind: 'appointment', timing: { mode: 'before-event', n: 8, unit: 'weeks' }, title: 'Planning call' },
      { id: 'b7', kind: 'document', timing: { mode: 'before-event', n: 6, unit: 'weeks' }, doc: 'Run sheet', approve: true },
      { id: 'b8', kind: 'email', timing: { mode: 'before-event', n: 3, unit: 'weeks' }, approve: true, subject: 'Final payment reminder', body: `Hi {{first names}},\n\nA quick reminder that the final payment of {{balance}} is due on {{due date}}. You can pay by card here: {{invoice link}}${sign}` },
      { id: 'b9', kind: 'start', timing: { mode: 'before-event', n: 2, unit: 'weeks' }, workflow: 'wf-fortnight' },
    ],
  },
  {
    id: 'wf-fortnight',
    name: 'Final fortnight',
    on: true,
    trigger: { id: 'workflow_completed', filters: [] },
    sentThisWeek: 3,
    lastSent: '3 days ago',
    clients: [C.amelia!, C.sarah!],
    steps: [
      { id: 'f1', kind: 'email', timing: { mode: 'before-event', n: 14, unit: 'days' }, approve: false, subject: 'Two weeks to go', body: `Hi {{first names}},\n\nTwo weeks to go! Could you confirm the final guest count and any late changes to the running order?${sign}` },
      { id: 'f2', kind: 'todo', timing: { mode: 'before-event', n: 7, unit: 'days' }, title: 'Confirm the sound check with the venue' },
      { id: 'f3', kind: 'email', timing: { mode: 'before-event', n: 2, unit: 'days' }, approve: false, subject: 'See you on the day', body: `Hi {{first names}},\n\nAll set for {{event date}}. I'll arrive at {{arrival time}} and find your coordinator. Enjoy the calm before the fun!${sign}` },
    ],
  },
  {
    id: 'wf-after',
    name: 'After the day',
    on: true,
    trigger: { id: 'days_after_event', filters: [] },
    sentThisWeek: 1,
    lastSent: 'Monday',
    clients: [C.hana!],
    steps: [
      { id: 'a1', kind: 'email', timing: { mode: 'after-event', n: 2, unit: 'days' }, approve: false, subject: 'Thank you both', body: `Hi {{first names}},\n\nWhat a day! Thank you for trusting me with it. If you have a minute, a review would mean the world: {{review link}}${sign}` },
      { id: 'a2', kind: 'stage', timing: { mode: 'now' }, stage: 'Completed' },
      { id: 'a3', kind: 'email', timing: { mode: 'after-event', n: 52, unit: 'weeks' }, approve: false, subject: 'Happy anniversary!', body: `Hi {{first names}},\n\nA year already! Wishing you both a very happy anniversary.${sign}` },
    ],
  },
  {
    id: 'wf-noshow',
    name: 'Missed consultation',
    on: false,
    trigger: { id: 'consultation_no_show', filters: [] },
    sentThisWeek: 0,
    clients: [],
    steps: [
      { id: 'n1', kind: 'email', timing: { mode: 'after', n: 1, unit: 'hours' }, approve: true, subject: 'Sorry we missed each other', body: `Hi {{first names}},\n\nLooks like we missed each other today, no worries at all. Here's my calendar to pick another time: {{booking link}}${sign}` },
    ],
  },
];

import { ContractIcon, EmailIcon, InvoiceIcon, ProposalIcon, QuestionnaireIcon, RunSheetIcon, TaskIcon, WeddingDayIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';


import type { DocumentKind } from '../documents/kinds';

import { PEOPLE, type OnJourney } from './journeys-people';
import type { Amount, Pay, Signers, StepEmail } from './step-settings';
import type { Timing } from './timing';

/**
 * The journeys an MC runs, one per type of work: what every client gets,
 * in order, from first enquiry to thank you. A journey is the documents
 * and the automation that sends them in one place (2026-10-05 founder:
 * Documents and Workflows merge into Journeys; Workflows itself was
 * removed 2026-10-14). Each step says when it
 * goes out in the MC's words, the document it sends, and the reminders
 * that follow it up. The wedding day itself sits on the line as a marker,
 * not a step. All demo data.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/journeys-data
 */

/**
 * What a step sends. `todo` sends nothing: it is a job for the MC (call to
 * go over the night), shown on Home when it is due. `day` is the event
 * itself (a wedding, a party), a marker on the line.
 */
export type StepKind = 'email' | 'proposal' | 'contract' | 'invoice' | 'questionnaire' | 'runSheet' | 'todo' | 'day';

/** One step on a journey. */
export interface JourneyStep {
  id: string;
  kind: StepKind;
  /** When it goes out; see `timing.ts`. Left out on the wedding day marker. */
  timing?: Timing | undefined;
  /** Timing in words, from journeys saved before timing was data; read through `timingOf`. */
  when?: string | undefined;
  /** What it is: "Contract". */
  name: string;
  /** Which one: "Standard MC agreement". */
  detail: string;
  /** The follow-ups after it goes out, in plain words. */
  reminders: string[];
  /** Waits for the MC's OK before it goes. */
  approve?: boolean | undefined;
  /**
   * For a step timed from the wedding, what happens when a client books
   * after its moment has passed (a questionnaire "8 weeks before" for a
   * couple who book 5 weeks out): it goes straight away (the default), or
   * is skipped for them.
   */
  late?: 'send' | 'skip' | undefined;
  /** The hour a step timed from something goes out at ("9:00 am"); see `step-settings.ts` for every default. */
  sendAt?: string | undefined;
  /** The email it goes out in, once the MC rewrites the one drafted for it. */
  email?: StepEmail | undefined;
  /** Reminder emails the MC has rewritten, by the follow-up they go with. */
  reminderEmails?: Record<string, StepEmail> | undefined;
  /** Proposal: days it stays open; 0 for never. */
  expires?: number | undefined;
  /** Contract: who signs. */
  signers?: Signers | undefined;
  /** Invoice: what it asks for. */
  amount?: Amount | undefined;
  /** Invoice: the percent of the package, when it asks for a custom share. */
  amountPct?: number | undefined;
  /** Invoice: days after it goes out that it is due. */
  dueIn?: number | undefined;
  /** Invoice: how they can pay. */
  pay?: Pay | undefined;
  /** Invoice: charge the card they paid with before, on the due date, when they agreed to it. */
  autoCharge?: boolean | undefined;
  /** Invoice right after a contract: goes with it, signed then paid on one page. */
  withPrev?: boolean | undefined;
  /** Questionnaire: weeks before the event it is due back. */
  dueBack?: number | undefined;
  /** Run sheet: also goes to the suppliers on the event once the couple approve it. */
  suppliers?: boolean | undefined;
  /** To-do: what to cover. */
  notes?: string | undefined;
}

/** One journey: a type of work and its steps. */
export interface Journey {
  id: string;
  /** The type of work: "Full weddings". */
  name: string;
  steps: JourneyStep[];
  /** The clients on it now, each at the step that is next for them. */
  people: OnJourney[];
  /** New enquiries start on this journey. Exactly one journey has it. */
  starts?: boolean | undefined;
}

/** Each kind's glyph on the line. */
export const STEP_ICON: Record<StepKind, ZebriIcon> = {
  email: EmailIcon,
  proposal: ProposalIcon,
  contract: ContractIcon,
  invoice: InvoiceIcon,
  questionnaire: QuestionnaireIcon,
  runSheet: RunSheetIcon,
  todo: TaskIcon,
  day: WeddingDayIcon,
};

/** The Documents kind a step's document lives under, for the ones with a library. */
export const DOCUMENT_OF: Partial<Record<StepKind, DocumentKind>> = {
  proposal: 'proposals',
  contract: 'contracts',
  invoice: 'invoices',
  questionnaire: 'questionnaires',
};

/**
 * Each kind's tint on the line, by family, so a glance tells them apart:
 * emails outlined, booking documents (proposal, contract) a light azure,
 * money a deeper azure, planning (questionnaire, run sheet) a grey tint,
 * the MC's to-dos a dashed outline. Green is the event's alone, so nothing
 * else on the line can be mistaken for it, and champagne is kept for
 * celebration (never a status or a surface).
 */
export const STEP_TONE: Record<StepKind, string> = {
  email: 'bg-field text-zebra-600 ring-1 ring-inset ring-zebra-200',
  proposal: 'bg-azure-100 text-azure-800',
  contract: 'bg-azure-100 text-azure-800',
  invoice: 'bg-azure-200 text-azure-900',
  questionnaire: 'bg-zebra-200 text-zebra-800',
  runSheet: 'bg-zebra-200 text-zebra-800',
  todo: 'bg-field text-zebra-600 border border-dashed border-zebra-300',
  day: 'bg-grass-100 text-grass-800',
};

/**
 * The event marker's detail, split: "Next: Sarah & Tom, Sat 12 Mar"
 * reads as the date beside the line and "Next: Sarah & Tom" on the card.
 */
export function eventParts(detail: string): { who: string; date?: string } {
  const at = detail.lastIndexOf(', ');
  return at === -1 ? { who: detail } : { who: detail.slice(0, at), date: detail.slice(at + 2) };
}

/**
 * What a step's card says: its name then the document ("Proposal  Full
 * day MC"), or the document alone when it already says the name
 * ("Balance invoice", not "Balance  Balance invoice").
 */
export function titleOf(step: JourneyStep): { name: string; detail?: string } {
  if (step.kind === 'day') return { name: step.name, detail: eventParts(step.detail).who };
  return step.detail.toLowerCase().includes(step.name.toLowerCase()) ? { name: step.detail } : { name: step.name, detail: step.detail };
}

/** A new step of `kind`, as Add a step makes it. */
export function newStep(kind: Exclude<StepKind, 'day'>): JourneyStep {
  const id = `step-${Date.now()}`;
  const base: Record<Exclude<StepKind, 'day'>, Omit<JourneyStep, 'id' | 'kind'>> = {
    email: { timing: { at: 'wedding', side: 'before', amount: 7, unit: 'days' }, name: 'Email', detail: 'A quick check in', reminders: [] },
    proposal: { timing: { at: 'manual' }, name: 'Proposal', detail: 'Full day MC', reminders: ['Remind them after 3 days'] },
    contract: { timing: { at: 'previous' }, name: 'Contract', detail: 'Standard MC agreement', reminders: ['Remind them after 3 days'] },
    invoice: { timing: { at: 'wedding', side: 'before', amount: 14, unit: 'days' }, name: 'Balance', detail: 'Balance invoice', reminders: ['Remind them after 3 days'] },
    questionnaire: { timing: { at: 'wedding', side: 'before', amount: 8, unit: 'weeks' }, name: 'Questionnaire', detail: 'Wedding day details', reminders: ['Remind them after 1 week'] },
    runSheet: { timing: { at: 'wedding', side: 'before', amount: 7, unit: 'days' }, name: 'Run sheet', detail: 'Ceremony to last dance', reminders: [], approve: true },
    todo: { timing: { at: 'wedding', side: 'before', amount: 14, unit: 'days' }, name: 'Call to go over the night', detail: 'Call to go over the night', reminders: [] },
  };
  return { id, kind, ...base[kind] };
}

const enquiry = (detail = 'Thanks for getting in touch'): JourneyStep => ({
  id: 'enquiry',
  kind: 'email',
  timing: { at: 'start' },
  name: 'Enquiry reply',
  detail,
  reminders: ['Remind them after 3 days'],
});

const thanks: JourneyStep = {
  id: 'thanks',
  kind: 'email',
  timing: { at: 'wedding', side: 'after', amount: 2, unit: 'days' },
  name: 'Thank you',
  detail: 'Thank you and review request',
  reminders: ['Remind them after 1 week'],
};

/** The demo business's journeys. */
export const JOURNEYS: Journey[] = [
  {
    id: 'full',
    name: 'Full weddings',
    starts: true,
    people: PEOPLE.full ?? [],
    steps: [
      enquiry(),
      { id: 'proposal', kind: 'proposal', timing: { at: 'manual' }, name: 'Proposal', detail: 'Full day MC', reminders: ['Remind them after 3 days'] },
      { id: 'contract', kind: 'contract', timing: { at: 'previous' }, name: 'Contract', detail: 'Standard MC agreement', reminders: ['Remind them after 3 days', 'Tell me after 1 week'] },
      { id: 'deposit', kind: 'invoice', timing: { at: 'previous' }, name: 'Deposit', detail: 'Deposit invoice', reminders: ['Remind them after 3 days'] },
      { id: 'questionnaire', kind: 'questionnaire', timing: { at: 'wedding', side: 'before', amount: 8, unit: 'weeks' }, name: 'Questionnaire', detail: 'Wedding day details', reminders: ['Remind them after 1 week', 'Tell me after 2 weeks'] },
      { id: 'balance', kind: 'invoice', timing: { at: 'wedding', side: 'before', amount: 14, unit: 'days' }, name: 'Balance', detail: 'Balance invoice', reminders: ['Remind them after 3 days'] },
      { id: 'call', kind: 'todo', timing: { at: 'wedding', side: 'before', amount: 10, unit: 'days' }, name: 'Call to go over the night', detail: 'Call to go over the night', notes: 'Entrances and pronunciations, speeches and who is giving them, the first dance song, anything that changed since the questionnaire.', reminders: [] },
      { id: 'run-sheet', kind: 'runSheet', timing: { at: 'wedding', side: 'before', amount: 7, unit: 'days' }, name: 'Run sheet', detail: 'Ceremony to last dance', reminders: [], approve: true, suppliers: true },
      { id: 'day', kind: 'day', name: 'Event day', detail: 'Next: Sarah & Tom, Sat 12 Mar', reminders: [] },
      thanks,
    ],
  },
  {
    id: 'ceremony',
    name: 'Ceremony only',
    people: PEOPLE.ceremony ?? [],
    steps: [
      enquiry(),
      { id: 'proposal', kind: 'proposal', timing: { at: 'manual' }, name: 'Proposal', detail: 'Ceremony only', reminders: ['Remind them after 3 days'] },
      { id: 'contract', kind: 'contract', timing: { at: 'previous' }, name: 'Contract', detail: 'Standard MC agreement', reminders: ['Remind them after 3 days'] },
      { id: 'invoice', kind: 'invoice', timing: { at: 'previous' }, name: 'Invoice', detail: 'Full fee invoice', reminders: ['Remind them after 3 days'] },
      { id: 'questionnaire', kind: 'questionnaire', timing: { at: 'wedding', side: 'before', amount: 6, unit: 'weeks' }, name: 'Questionnaire', detail: 'Ceremony details', reminders: ['Remind them after 1 week'] },
      { id: 'day', kind: 'day', name: 'Event day', detail: 'Next: Ruby & Kai, Sat 2 Apr', reminders: [] },
      thanks,
    ],
  },
  {
    id: 'corporate',
    name: 'Corporate',
    people: PEOPLE.corporate ?? [],
    steps: [
      enquiry('Thanks, here is how I work with events'),
      { id: 'proposal', kind: 'proposal', timing: { at: 'manual' }, name: 'Proposal', detail: 'Corporate', reminders: ['Remind them after 3 days'] },
      { id: 'invoice', kind: 'invoice', timing: { at: 'previous' }, name: 'Invoice', detail: 'Full fee invoice', dueIn: 14, reminders: ['Remind them after 3 days', 'Tell me after 1 week'] },
      { id: 'run-sheet', kind: 'runSheet', timing: { at: 'wedding', side: 'before', amount: 5, unit: 'days' }, name: 'Run sheet', detail: 'Event running order', reminders: [], approve: true },
      { id: 'day', kind: 'day', name: 'Event day', detail: 'Next: Hannah & Leo, Fri 18 Mar', reminders: [] },
      { id: 'thanks', kind: 'email', timing: { at: 'wedding', side: 'after', amount: 2, unit: 'days' }, name: 'Thank you', detail: 'Thank you and testimonial request', reminders: [] },
    ],
  },
];

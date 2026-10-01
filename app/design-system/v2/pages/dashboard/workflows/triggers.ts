/**
 * What can start a workflow, in the words the story's first line uses.
 * The same vocabulary as the production trigger registry
 * (`lib/automations/triggers.ts`), grouped the way an MC thinks about
 * their week rather than by table. Filters are the common narrowing
 * rules, offered as chips.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/triggers
 */

import { flatSteps, type Workflow } from './model';

export interface TriggerDef {
  id: string;
  group: string;
  /** Reads after "When": "a proposal is accepted". */
  words: string;
}

export const TRIGGERS: TriggerDef[] = [
  { id: 'new_enquiry', group: 'Leads', words: 'a new enquiry comes in' },
  { id: 'lead_inactive', group: 'Leads', words: 'a lead goes quiet' },
  { id: 'consultation_booked', group: 'Leads', words: 'a consultation is booked' },
  { id: 'consultation_no_show', group: 'Leads', words: 'a consultation is missed' },
  { id: 'proposal_sent', group: 'Proposals', words: 'a proposal is sent' },
  { id: 'proposal_opened', group: 'Proposals', words: 'a proposal is opened' },
  { id: 'proposal_accepted', group: 'Proposals', words: 'a proposal is accepted' },
  { id: 'proposal_expiring', group: 'Proposals', words: 'a proposal is about to expire' },
  { id: 'contract_signed', group: 'Contracts and payments', words: 'a contract is signed' },
  { id: 'invoice_sent', group: 'Contracts and payments', words: 'an invoice is sent' },
  { id: 'payment_received', group: 'Contracts and payments', words: 'a payment comes in' },
  { id: 'invoice_overdue', group: 'Contracts and payments', words: 'an invoice goes overdue' },
  { id: 'payment_failed', group: 'Contracts and payments', words: 'a card payment fails' },
  { id: 'days_before_event', group: 'The event', words: 'the event is coming up' },
  { id: 'days_after_event', group: 'The event', words: 'the event has happened' },
  { id: 'event_anniversary', group: 'The event', words: "it's their anniversary" },
  { id: 'stage_changed', group: 'Clients', words: 'a client changes stage' },
  { id: 'portal_abandoned', group: 'Clients', words: 'a client leaves a form half done' },
  { id: 'workflow_completed', group: 'Clients', words: 'another workflow finishes' },
  { id: 'manual', group: 'Clients', words: 'you start it for a client' },
];

/** Chips offered under any trigger. */
export const FILTERS = ['Weddings only', 'Over $2,000', 'This year only', 'Has a venue', 'Not already booked'];

export const triggerOf = (id: string) => TRIGGERS.find((t) => t.id === id) ?? TRIGGERS[0]!;

/** "When a proposal is accepted". */
export const triggerLine = (id: string) => `When ${triggerOf(id).words}`;

/**
 * What starts a workflow, in the list's words. A workflow that another
 * one hands clients to names that one ("Started by Booked client"), so a
 * chain can be followed without opening either.
 */
export function workflowTriggerLine(w: Workflow, all: readonly Workflow[]): string {
  if (w.trigger.id === 'workflow_completed' || w.trigger.id === 'manual') {
    const from = all.find((o) => o.id !== w.id && flatSteps(o.steps).some((s) => s.kind === 'start' && s.workflow === w.id));
    if (from) return `Started by ${from.name}`;
  }
  return triggerLine(w.trigger.id);
}

/** Where a client can be moved to. */
export const STAGES = ['Enquiry', 'Proposal sent', 'Booked', 'Planning', 'Final details', 'Completed'];

/** What an If step can wait on. */
export const CONDITIONS = [
  "the questionnaire isn't back",
  "the proposal isn't accepted",
  "the contract isn't signed",
  "the deposit isn't paid",
  "they haven't replied",
];

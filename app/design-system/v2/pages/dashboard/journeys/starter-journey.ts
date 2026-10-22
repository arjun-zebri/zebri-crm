import { starterFor } from '../first-run/starter';

import type { Journey, JourneyStep } from './journeys-data';

/**
 * A new MC's first journey: short enough to read in a glance (seven stops,
 * the day included), for the first run to walk its test couples down.
 * Pure, so it is built from the roles alone and nothing needs handing over.
 *
 * Step ids are fixed (`proposal`, `contract`, `deposit`, …) so the first
 * run can place its test client on a step by id.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/starter-journey
 */

/**
 * The starter journey for `roles` (none reads as MC): a thank-you email,
 * the proposal 20 minutes later, contract, deposit, the planning call
 * (the MC's own to-do, four weeks out), balance, the day. Kept short on
 * purpose (founder, 2026-10-08): no questionnaire, no paperwork and, for
 * now, no thank-you after the day; the MC adds those when they want them. The balance falls 14 days before, as
 * the contract and the deposit invoice say by default. `day` names the
 * client and date on the event marker, for the first run's test client;
 * left out, the marker just says the day.
 */
export function starterJourney(roles: string[], day?: { who: string; date?: string | undefined }): Journey {
  const steps: JourneyStep[] = [
    // A thank-you the moment a couple comes in, saying the proposal is on its way (its draft says so: `step-email.ts`).
    { id: 'welcome', kind: 'email', timing: { at: 'start' }, name: 'Email', detail: 'Thank you for choosing me', reminders: [] },
    // Then the proposal, 20 minutes later, so it lands as promised without the MC sending it.
    { id: 'proposal', kind: 'proposal', timing: { at: 'previous', amount: 20, unit: 'minutes' }, name: 'Proposal', detail: starterFor(roles).name, reminders: ['Remind them after 3 days'] },
    // Drafted by Zebri when they say yes, signed by the MC before it goes, so it needs them.
    { id: 'contract', kind: 'contract', timing: { at: 'previous' }, name: 'Contract', detail: 'Service agreement', reminders: ['Remind them after 3 days'], approve: true },
    { id: 'deposit', kind: 'invoice', timing: { at: 'previous' }, name: 'Deposit', detail: 'Deposit invoice', reminders: ['Remind them after 3 days'] },
    // The one step that is the MC's own: the call where the day is planned. A to-do, so it reads as Needs you.
    { id: 'planning', kind: 'todo', timing: { at: 'wedding', side: 'before', amount: 4, unit: 'weeks' }, name: 'Planning call', detail: 'Go over the day with them', notes: 'Timings, entrances and pronunciations, speeches and who is giving them, the songs, anything that has changed.', reminders: [] },
    { id: 'balance', kind: 'invoice', timing: { at: 'wedding', side: 'before', amount: 14, unit: 'days' }, name: 'Balance', detail: 'Balance invoice', reminders: ['Remind them after 3 days'] },
    { id: 'day', kind: 'day', name: 'Wedding day', // "who, date": an empty who leaves the date for beside the line and nothing on the card.
    detail: day ? (day.date ? `${day.who}, ${day.date}` : day.who) : '', reminders: [] },
  ];
  return { id: 'starter', name: 'Weddings', starts: true, people: [], steps };
}

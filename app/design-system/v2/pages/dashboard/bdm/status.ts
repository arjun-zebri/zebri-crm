import type { DocSection } from '../documents/doc-item';

import { dayText, daysUntil, lodgeBy, married, weddingDate, weddingDay, type Paperwork } from './bdm-data';
import { afterGroups, beforeGroups, progress } from './checks';
import { missing } from './noim-questions';

/**
 * Where a couple's paperwork stands, in words, and the one thing to do
 * next, for every surface that shows it (the client's Documents row and
 * panel, the paperwork dialog, the Documents page, Home), so they never
 * disagree. The celebrant sees three steps (`STEPS`: Couple's details,
 * Before the day, Lodge) with one button at a time: Send to couple,
 * Remind, Mark notice signed, Lodge with BDM. After that the Registry
 * moves it on by itself.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/status
 */

/** The next step, as its button reads. Null when nothing is left to do. */
export type Next = 'send' | 'remind' | 'check' | 'wait' | 'lodge' | 'registry' | null;

export function nextOf(p: Paperwork): Next {
  switch (p.stage) {
    case 'draft':
      return 'send';
    case 'sent':
      return 'remind';
    case 'returned':
      return 'check';
    case 'checked':
      return married(p) ? 'lodge' : 'wait';
    case 'lodged':
      // With the Registry: nothing for the celebrant to press, it updates itself.
      return 'registry';
    case 'registered':
      return null;
  }
}

/** The three steps the celebrant sees, in order. */
export const STEPS = ["Couple's details", 'Before the day', 'Lodge'] as const;

/** Which of the three steps it is on: 0 while with the couple, 1 to check, 2 from the notice in order on. */
export function stepOf(p: Paperwork): 0 | 1 | 2 {
  if (p.stage === 'draft' || p.stage === 'sent') return 0;
  if (p.stage === 'returned') return 1;
  return 2;
}

/** "With the couple", "To lodge", "Registered". */
export function stateOf(p: Paperwork): string {
  switch (p.stage) {
    case 'draft':
      return 'Not sent';
    case 'sent':
      return 'With the couple';
    case 'returned':
      return 'To check';
    case 'checked':
      return married(p) ? 'To lodge' : 'Ready for the day';
    case 'lodged':
      // The Registry's word, when it is more than "taken".
      return p.registry === 'Non Compliant' ? 'BDM is checking it' : p.registry === 'Suspended' ? 'Suspended by BDM' : p.registry === 'Cancelled' ? 'Cancelled by BDM' : 'With BDM';
    case 'registered':
      return 'Registered';
  }
}

/** "Lodge by Sat 17 Oct", or how overdue it is. */
export function dueOf(p: Paperwork, now = new Date()): string {
  const by = lodgeBy(p);
  if (!by) return 'Lodge within 14 days';
  const days = daysUntil(by, now);
  if (days < 0) return `Overdue: was due ${dayText(by)}`;
  if (days === 0) return 'Lodge today';
  return `Lodge by ${dayText(by)}${days <= 3 ? `, ${days} ${days === 1 ? 'day' : 'days'} left` : ''}`;
}

/** One line on it, under the names: what the couple or the Registry has done. */
export function lineOf(p: Paperwork): string {
  const left = missing(p).length;
  switch (p.stage) {
    case 'draft':
      return 'Not sent yet';
    case 'sent':
      return `${left} ${left === 1 ? 'answer' : 'answers'} to go · Sent ${p.sentOn ?? ''}`;
    case 'returned':
      return `Back from them · ${checksLeft(p)} to tick`;
    case 'checked':
      return married(p) ? dueOf(p) : `Wedding ${weddingDay(p)} · lodge after the day`;
    case 'lodged':
      return `Lodged ${p.lodgedOn ?? ''} · ${p.notification ?? ''}${p.registry && p.registry !== 'Compliant' ? ` · ${p.registry}` : ''}`;
    case 'registered':
      // statusQuery says Complete without a number; it arrives by BDM's email.
      return p.registration ? `Registration ${p.registration}` : `Registered · notification ${p.notification ?? ''}`;
  }
}

/** The tracker's words for each step, with the Lodge step's date: "Lodge · by Sat 17 Oct". */
export function stepLabels(p: Paperwork): string[] {
  const by = lodgeBy(p);
  const lodge =
    p.stage === 'checked' && !married(p) ? `Lodge · after ${weddingDate(p) ? weddingDay(p) : 'the wedding'}` : p.stage === 'checked' && by ? `Lodge · by ${dayText(by)}` : STEPS[2];
  return [STEPS[0], STEPS[1], lodge];
}

/** The before-the-wedding checks not done yet. */
export function checksLeft(p: Paperwork) {
  const { done, of } = progress(beforeGroups(p), p.checks);
  return of - done;
}

/** The after-the-wedding checks not done yet. */
export function solemnisationLeft(p: Paperwork) {
  const { done, of } = progress(afterGroups(p), p.checks);
  return of - done;
}

/** Where it sits in the paperwork list (`PAPERWORK_SECTIONS`). */
export function sectionOf(p: Paperwork): DocSection {
  switch (nextOf(p)) {
    case 'check':
    case 'lodge':
      return 'needs';
    case 'send':
      return 'draft';
    case 'remind':
      return 'couple';
    case 'wait':
      return 'day';
    case 'registry':
      return 'bdm';
    case null:
      return 'done';
  }
}

/** Needs the celebrant now: details to check, or a wedding to lodge. */
export const needsYou = (p: Paperwork) => sectionOf(p) === 'needs';

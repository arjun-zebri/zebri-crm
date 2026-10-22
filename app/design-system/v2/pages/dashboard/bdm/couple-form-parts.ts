import { pagesOf } from '../questionnaires/client-view/paged-style';
import { answerText, type Question } from '../questionnaires/questionnaire-data';

import type { Paperwork } from './bdm-data';
import { firstName, prefill } from './noim-questions';

/**
 * The couple's form as named parts, for its rail and its Check your
 * answers page (user, 2026-10-15: nine unnamed dashes said how far, not
 * what was left). Each section is a part, grouped by whose it is, so it
 * reads the way a couple thinks of it: Arjun's details, parents and ID,
 * then Priya's, then the two of them. A part is done when every answer it
 * needs is in and none is refused.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/couple-form-parts
 */

/** One part of the form: one page of `PagedStyle`. */
export interface FormPart {
  /** Its page, 0-based. */
  at: number;
  /** Whose it is: "Arjun", "Priya", or "Together". */
  group: string;
  /** Its short name in the rail: "Details", "Parent 1", "ID". */
  label: string;
  /** Its heading, the page's title: "Arjun's details". */
  title: string;
  questions: Question[];
  done: boolean;
}

/** A section's short name, by the end of its id. */
const SHORT: Record<string, string> = { section: 'Details', fatherSection: 'Parent 1', motherSection: 'Parent 2', idSection: 'ID' };

/** The parts, in order, given the questions that apply now and what is wrong with the answers. */
export function formParts(p: Paperwork, questions: Question[], problems: Record<string, string>): FormPart[] {
  const group = (id: string) => {
    if (id.startsWith('p1.')) return firstName(p, 0);
    if (id.startsWith('p2.')) return firstName(p, 1);
    return 'Together';
  };
  return pagesOf(questions).map((page, at) => {
    const head = page[0]?.type === 'section' ? page[0] : undefined;
    const body = page.filter((q) => q.type !== 'section');
    const id = head?.id ?? '';
    return {
      at,
      group: group(id),
      label: id === 'related.section' ? 'The two of you' : (SHORT[id.split('.')[1] ?? ''] ?? head?.label ?? `Part ${at + 1}`),
      title: head?.label ?? `Part ${at + 1}`,
      questions: body,
      done: body.every((q) => !problems[q.id] && (!q.required || answerText(p.answers[q.id]).trim() !== '')),
    };
  });
}

/**
 * The questions with a note under a person's heading when Zebri filled
 * in their names from the booking and they have not changed them: a
 * typo in the booking becomes a typo on the marriage certificate (user,
 * 2026-10-15). One note on the heading, not one under each name, which
 * wrapped and set the name rows out of line.
 */
export function withPrefillNotes(p: Paperwork, questions: Question[]): Question[] {
  const filled = prefill(p.names);
  const untouched = (who: string) =>
    Object.keys(filled).some((id) => id.startsWith(`${who}.`) && id.endsWith('Name') && answerText(filled[id]) === answerText(p.answers[id]));
  return questions.map((q) => {
    const who = q.id.split('.')[0] ?? '';
    return q.id === `${who}.section` && untouched(who) ? { ...q, help: `${q.help} We filled in the names from your booking, so check the spelling.` } : q;
  });
}

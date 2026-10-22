import type { ToFix } from '../questionnaires/client-view/to-fix';
import type { Answer } from '../questionnaires/questionnaire-data';

import { whose, type Paperwork } from './bdm-data';
import { setAnswer } from './bdm-store';
import { formQuestions, missing, withLinked } from './noim-questions';
import { issuesOf } from './rules';

/**
 * The couple's form checked as the Registry would (`rules.ts`): what
 * each answer is refused for and what Submit waits on, shared by the
 * celebrant's copy (`their-answers.tsx`) and the couple's own page
 * (`couple-form-page.tsx`), so the two always agree.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/couple-checks
 */

/**
 * What is wrong with the couple's answers, by question id, and the list
 * Submit waits on: a required answer not given, or one the Registry
 * would refuse. An issue's key is its question's id, or that id with a
 * suffix ("p1.givenName.space"). Only the couple's own answers count: the
 * celebrant's checks are not theirs to fix.
 */
export function coupleChecks(p: Paperwork): { problems: Record<string, string>; toFix: ToFix[] } {
  const questions = formQuestions(p).filter((q) => q.type !== 'section');
  const owner = (key: string) =>
    questions
      .filter((q) => key === q.id || key.startsWith(`${q.id}.`))
      .sort((a, b) => b.id.length - a.id.length)[0];
  const problems: Record<string, string> = {};
  const toFix: ToFix[] = [];
  // A blank answer is listed above Submit ("Needed") but never marked in red under its question: on one long page, forty red lines before they have typed a thing reads as a telling-off.
  const blank = new Set(missing(p).map((q) => q.id));
  issuesOf(p).forEach((issue) => {
    if (blank.has(issue.key)) return;
    const q = owner(issue.key);
    // One line an answer, the first problem found.
    if (!q || problems[q.id]) return;
    problems[q.id] = issue.problem;
    toFix.push({ id: q.id, label: issue.label, problem: issue.problem });
  });
  missing(p).forEach((q) => {
    if (problems[q.id] || toFix.some((x) => x.id === q.id)) return;
    const who = q.id.startsWith('p1.') ? whose(p, 0) : q.id.startsWith('p2.') ? whose(p, 1) : null;
    toFix.push({ id: q.id, label: who ? `${who}: ${q.label}` : q.label, problem: 'Needed' });
  });
  // Shown in the form's order, so the list reads top to bottom.
  const order = (id: string) => questions.findIndex((q) => q.id === id);
  return { problems, toFix: toFix.sort((a, b) => order(a.id) - order(b.id)) };
}

/** Saves an answer and any it carries with it (a shared home's address). */
export function answer(p: Paperwork, id: string, a: Answer) {
  Object.entries(withLinked(id, a, p.answers)).forEach(([key, value]) => setAnswer(p.client, key, value));
}

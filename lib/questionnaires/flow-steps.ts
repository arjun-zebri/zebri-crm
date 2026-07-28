/**
 * Pure helpers for walking a questionnaire's questions as flow steps.
 *
 * A step is one answerable question plus the section heading (if any) that
 * immediately precedes it, so the one-at-a-time flow can show the section as
 * context. Kept in lib so the public flow, the previews, and tests share one
 * definition of "the steps".
 *
 * @module lib/questionnaires/flow-steps
 */

import { QUESTION_TYPE_META, type Question } from './question-schema'

/** One answerable step: the question plus its governing section heading. */
export interface FlowStep {
  question: Question
  section: string | null
}

/**
 * Flattens a question list into answerable steps, attaching to each the label
 * of the closest preceding `section` heading (or null before any section).
 */
export function buildSteps(questions: Question[]): FlowStep[] {
  let section: string | null = null
  const out: FlowStep[] = []
  for (const q of questions) {
    if (q.type === 'section') section = q.label
    else if (QUESTION_TYPE_META[q.type].isInput) out.push({ question: q, section })
  }
  return out
}

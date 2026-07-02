/**
 * Pure helpers for editing a questionnaire's question list.
 *
 * The builder modal is a thin shell over these functions: every add, edit,
 * reorder, and delete goes through here so the logic stays free of React and
 * is unit-testable in isolation. None of these mutate their input.
 *
 * @module lib/questionnaires/builder-state
 */

import { QUESTION_TYPE_META, type Question, type QuestionType } from './question-schema'

/**
 * Builds a new, empty question of the given type with a caller-supplied id.
 * Choice types start with two blank options so the builder has rows to edit.
 * The id is passed in (rather than generated here) to keep the function pure.
 */
export function createQuestion(type: QuestionType, id: string): Question {
  const base: Question = { id, type, label: '', required: false }
  if (QUESTION_TYPE_META[type].hasOptions) {
    return { ...base, options: ['', ''] }
  }
  return base
}

/** Appends a question to the list. */
export function addQuestion(questions: Question[], question: Question): Question[] {
  return [...questions, question]
}

/** Applies a partial patch to the question with the given id. */
export function updateQuestion(questions: Question[], id: string, patch: Partial<Question>): Question[] {
  return questions.map((q) => (q.id === id ? { ...q, ...patch } : q))
}

/** Removes the question with the given id. */
export function removeQuestion(questions: Question[], id: string): Question[] {
  return questions.filter((q) => q.id !== id)
}

/**
 * Moves the question identified by `activeId` to the position currently held by
 * `overId`, preserving the order of every other question. A no-op when either
 * id is missing.
 */
export function moveQuestion(questions: Question[], activeId: string, overId: string): Question[] {
  const from = questions.findIndex((q) => q.id === activeId)
  const to = questions.findIndex((q) => q.id === overId)
  if (from === -1 || to === -1 || from === to) return questions
  const next = [...questions]
  const [moved] = next.splice(from, 1)
  if (!moved) return questions
  next.splice(to, 0, moved)
  return next
}

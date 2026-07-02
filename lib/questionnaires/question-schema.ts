/**
 * Questionnaire question + response schemas.
 *
 * The single source of truth for the shape of a questionnaire question and a
 * couple's answers. Shared by the template builder, the server actions that
 * persist templates and instances, and the public submit path. Keeping the Zod
 * schemas here means the builder UI, the API routes, and the tests all validate
 * against exactly the same contract.
 *
 * @module lib/questionnaires/question-schema
 */

import { z } from 'zod'

/**
 * The question types supported in v1. `section` is a non-input heading used to
 * group questions; every other type collects an answer.
 */
export type QuestionType =
  | 'short_text'
  | 'long_text'
  | 'single_choice'
  | 'multiple_choice'
  | 'date'
  | 'time'
  | 'yes_no'
  | 'number'
  | 'section'

/** UI + behaviour metadata for each question type. */
export interface QuestionTypeMeta {
  /** Human label shown in the builder's type picker. */
  label: string
  /** Whether the type carries a list of choice options. */
  hasOptions: boolean
  /** Whether the type collects an answer (false for `section`). */
  isInput: boolean
}

/** Ordered, display-friendly metadata for every question type. */
export const QUESTION_TYPE_META: Record<QuestionType, QuestionTypeMeta> = {
  short_text: { label: 'Short text', hasOptions: false, isInput: true },
  long_text: { label: 'Long text', hasOptions: false, isInput: true },
  single_choice: { label: 'Single choice', hasOptions: true, isInput: true },
  multiple_choice: { label: 'Multiple choice', hasOptions: true, isInput: true },
  date: { label: 'Date', hasOptions: false, isInput: true },
  time: { label: 'Time', hasOptions: false, isInput: true },
  yes_no: { label: 'Yes / No', hasOptions: false, isInput: true },
  number: { label: 'Number', hasOptions: false, isInput: true },
  section: { label: 'Section heading', hasOptions: false, isInput: false },
}

/** Question types presented in the builder, in display order. */
export const QUESTION_TYPES = Object.keys(QUESTION_TYPE_META) as QuestionType[]

/**
 * A single question in a questionnaire. `options` is only meaningful for the
 * choice types; `required` is ignored for `section` headings.
 */
export const questionSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    'short_text',
    'long_text',
    'single_choice',
    'multiple_choice',
    'date',
    'time',
    'yes_no',
    'number',
    'section',
  ]),
  label: z.string().min(1, 'Question text is required').max(500),
  help_text: z.string().max(1000).optional(),
  required: z.boolean().default(false),
  options: z.array(z.string().min(1).max(200)).max(50).optional(),
})

/** A single question object. */
export type Question = z.infer<typeof questionSchema>

/** The ordered list of questions that make up a questionnaire. */
export const questionsSchema = z.array(questionSchema).max(100)

/**
 * A single answer value. Text/date/time/single-choice/yes-no answers are
 * strings, numbers are numbers, and multiple-choice answers are string arrays.
 */
export const answerSchema = z.union([z.string(), z.number(), z.array(z.string())])

/** Answer value for one question. */
export type Answer = z.infer<typeof answerSchema>

/** Couple answers keyed by question id. */
export const responsesSchema = z.record(z.string(), answerSchema)

/** The full responses map for a questionnaire. */
export type Responses = z.infer<typeof responsesSchema>

/**
 * Returns the ids of required input questions that have no usable answer in
 * `responses`. An empty array means the questionnaire is ready to submit. Pure
 * and dependency-free so both the public page and tests can call it.
 */
export function missingRequiredAnswers(questions: Question[], responses: Responses): string[] {
  return questions
    .filter((q) => QUESTION_TYPE_META[q.type].isInput && q.required)
    .filter((q) => !hasAnswer(responses[q.id]))
    .map((q) => q.id)
}

/** Whether an answer value counts as filled in (not blank / not an empty list). */
function hasAnswer(value: Answer | undefined): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true // numbers (including 0) count as answered
}

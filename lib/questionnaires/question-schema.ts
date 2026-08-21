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
 * The question types a questionnaire can contain. `section` is a non-input
 * heading used to group questions; every other type collects an answer.
 */
export type QuestionType =
  | 'short_text'
  | 'long_text'
  | 'single_choice'
  | 'multiple_choice'
  | 'dropdown'
  | 'date'
  | 'time'
  | 'yes_no'
  | 'number'
  | 'email'
  | 'phone'
  | 'section'

/**
 * How a questionnaire renders for the couple: `typeform` walks through one
 * question at a time; `form` shows every question on a single page. Stored on
 * the template and snapshotted onto each sent questionnaire.
 */
export type QuestionnaireDisplayMode = 'typeform' | 'form'

/** Display modes in picker order, with human labels for the builder toggle. */
export const DISPLAY_MODES: ReadonlyArray<{ value: QuestionnaireDisplayMode; label: string }> = [
  { value: 'typeform', label: 'One at a time' },
  { value: 'form', label: 'All on one page' },
]

/** Narrows an untrusted string (e.g. a DB read) to a display mode. */
export function toDisplayMode(value: unknown): QuestionnaireDisplayMode {
  return value === 'form' ? 'form' : 'typeform'
}

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
  dropdown: { label: 'Dropdown', hasOptions: true, isInput: true },
  date: { label: 'Date', hasOptions: false, isInput: true },
  time: { label: 'Time', hasOptions: false, isInput: true },
  yes_no: { label: 'Yes / No', hasOptions: false, isInput: true },
  number: { label: 'Number', hasOptions: false, isInput: true },
  email: { label: 'Email address', hasOptions: false, isInput: true },
  phone: { label: 'Phone number', hasOptions: false, isInput: true },
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
    'dropdown',
    'date',
    'time',
    'yes_no',
    'number',
    'email',
    'phone',
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
 * What a couple sees when a required question has no answer yet.
 *
 * Phrased as the next step rather than as a rule being enforced: "This one is
 * required" tells someone off without telling them what to do, and "this one"
 * is vague when the message sits under the question it refers to. Shared by
 * the one-at-a-time flow and the all-on-one-page form so the two cannot drift.
 */
export const REQUIRED_ANSWER_MESSAGE = 'Please answer this to continue.'

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

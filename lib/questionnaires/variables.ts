/**
 * Name variables in questionnaire templates.
 *
 * An MC writes `{{couple.primary_name | first}}'s Couples Questionnaire`
 * on the template, and each couple's copy reads "Ayeel's Couples
 * Questionnaire". The tokens are the workflow/email variable syntax
 * (`lib/automations/variables`), so an MC who already uses them in
 * email templates sees the same names here.
 *
 * Resolved once, when a couple's questionnaire is created from the
 * template (the row is a snapshot), never at view time: the couple's
 * page and the MC's answers view both show plain text.
 *
 * @module lib/questionnaires/variables
 */

import { renderTemplate } from '@/lib/automations/variables'
import type { EditorVariable } from '@/lib/email/template-variables'
import type { RunContext } from '@/types/automations'

import type { Question } from './question-schema'

/**
 * The variables offered in the questionnaire editor. Names, the date
 * and the venue only: links, emails and phone numbers have no place in
 * a questionnaire's title or questions.
 */
export const QUESTIONNAIRE_VARIABLES: readonly EditorVariable[] = [
  { id: 'couple.primary_name | first', label: 'Partner 1 first name', description: 'e.g. Sam' },
  { id: 'couple.spouse_name | first', label: 'Partner 2 first name', description: 'e.g. Alex' },
  { id: 'couple.primary_name', label: 'Partner 1 full name', description: 'e.g. Sam Taylor' },
  { id: 'couple.spouse_name', label: 'Partner 2 full name', description: 'e.g. Alex Morgan' },
  { id: 'couple.name', label: 'Couple name', description: 'e.g. Sam & Alex' },
  { id: 'event.date | friendly', label: 'Event date', description: 'e.g. Sat 12 Apr 2026' },
  { id: 'venue.name', label: 'Venue name', description: 'e.g. The Calile' },
  { id: 'mc.business_name', label: 'Your business name', description: 'e.g. Acme MC Co' },
]

/** The parts of a questionnaire that carry MC-written text. */
export interface QuestionnaireText {
  title: string
  description: string | null
  questions: Question[]
}

/**
 * Fill every variable in a questionnaire's title, description, question
 * text, help text and choice options from one couple's context.
 *
 * A variable the couple has no value for (no second partner on file)
 * renders empty, the same as in emails. Text without `{{` is returned
 * as-is.
 */
export function personalizeQuestionnaire(text: QuestionnaireText, ctx: RunContext): QuestionnaireText {
  const fill = (value: string) => (value.includes('{{') ? renderTemplate(value, ctx) : value)
  return {
    title: fill(text.title),
    description: text.description === null ? null : fill(text.description),
    questions: text.questions.map((q) => ({
      ...q,
      label: fill(q.label),
      ...(q.help_text !== undefined ? { help_text: fill(q.help_text) } : {}),
      // An option that was only a variable with no value would render as
      // a blank choice, so it is dropped.
      ...(q.options !== undefined ? { options: q.options.map(fill).filter((o) => o.trim()) } : {}),
    })),
  }
}

const TOKEN_RE = /\{\{\s*([^}]+?)\s*\}\}/g

/** Collapse spaces so `couple.primary_name|first` matches the catalogue id. */
function normalise(expr: string): string {
  return expr
    .split('|')
    .map((part) => part.trim())
    .join(' | ')
}

/**
 * Text with each variable shown as its label, for MC-facing places that
 * have no couple to fill it from (the send menu, a template list):
 * "{{couple.primary_name | first}}'s Questionnaire" reads "Partner 1
 * first name's Questionnaire". An unknown expression shows as itself.
 */
export function labelVariables(text: string): string {
  if (!text.includes('{{')) return text
  return text.replace(TOKEN_RE, (_m, expr: string) => {
    const id = normalise(expr)
    return QUESTIONNAIRE_VARIABLES.find((v) => v.id === id)?.label ?? id
  })
}

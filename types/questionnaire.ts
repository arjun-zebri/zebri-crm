/**
 * Questionnaire domain types.
 *
 * Mirrors the `questionnaire_templates` and `couple_questionnaires` tables.
 * The question and answer shapes live in `lib/questionnaires/question-schema`
 * (the validation source of truth); this module composes them into the
 * record-level types used across the templates hub, the couple profile, and
 * the public surface.
 *
 * @module types/questionnaire
 */

import type { Question, Responses } from '@/lib/questionnaires/question-schema'

/** Lifecycle of a per-couple questionnaire instance. */
export type QuestionnaireStatus = 'draft' | 'sent' | 'completed'

/** An MC-owned reusable questionnaire template. */
export interface QuestionnaireTemplate {
  id: string
  user_id: string
  name: string
  description: string | null
  /** Ordered questions; the source the builder edits. */
  questions: Question[]
  /** True for pre-built starters the MC can clone. */
  is_starter: boolean
  position: number
  created_at: string
  updated_at: string
}

/**
 * A questionnaire sent to a specific couple. `questions` is a snapshot taken at
 * send time, so editing the source template never changes a questionnaire the
 * couple already has.
 */
export interface CoupleQuestionnaire {
  id: string
  user_id: string
  couple_id: string
  /** Source template, or null if the template was later deleted. */
  template_id: string | null
  title: string
  questions: Question[]
  responses: Responses
  status: QuestionnaireStatus
  share_token: string
  share_token_enabled: boolean
  sent_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

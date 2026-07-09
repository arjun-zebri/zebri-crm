/**
 * Shared types + pure helpers for the public questionnaire surface.
 *
 * The shape is the JSONB payload from `get_public_questionnaire(token)`:
 * the questionnaire fields plus the merged `PublicBranding` scalars. Mirrors
 * `app/contract/[token]/_components/public-contract.ts`.
 *
 * @module app/questionnaire/[token]/_components/public-questionnaire
 */
import type { PublicBranding } from '@/lib/branding/public-surface'
import type { Question, Responses } from '@/lib/questionnaires/question-schema'

/** Payload returned by `get_public_questionnaire`. */
export interface PublicQuestionnaire extends PublicBranding {
  id: string
  title: string
  status: string
  /** 'typeform' (one question at a time) or 'form' (all on one page). */
  display_mode: string
  questions: Question[]
  responses: Responses
  completed_at: string | null
  couple_name: string
}

/**
 * Page-state machine. `loading` and `not_found` are owned by the orchestrator;
 * a completed questionnaire shows the thank-you state, everything else is the
 * fillable flow.
 */
export type PageState = 'loading' | 'not_found' | 'active' | 'completed'

export function deriveState(questionnaire: PublicQuestionnaire | null): PageState {
  if (!questionnaire) return 'not_found'
  if (questionnaire.status === 'completed') return 'completed'
  return 'active'
}

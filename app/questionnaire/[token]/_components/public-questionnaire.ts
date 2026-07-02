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

/**
 * Returns a readable foreground (`#ffffff` or `#111827`) for text/icons placed
 * on top of the given hex colour, using perceived luminance. Keeps the brand
 * button legible whether the MC's brand colour is light (mint) or dark.
 */
export function readableTextOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m?.[1]) return '#111827'
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  // Rec. 601 luma; >150 reads as "light", so use dark text.
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111827' : '#ffffff'
}

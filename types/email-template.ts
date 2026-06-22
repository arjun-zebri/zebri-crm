/**
 * Email-template domain types.
 *
 * Mirrors the `email_templates` table
 * (`supabase/migrations/20260618000000_create_email_templates_feature.sql`).
 * The body is TipTap JSON; the subject is a mustache string. Both
 * resolve through `lib/email/templates` at render time.
 *
 * @module types/email-template
 */

import type { JSONContent } from '@tiptap/react'

/** Ordered lifecycle stages — mirrors the table's CHECK constraint. */
export const LIFECYCLE_STAGES = [
  'enquiry',
  'quote',
  'booking',
  'planning',
  'wedding_week',
  'follow_up',
] as const

/** A wedding-lifecycle stage tag for grouping + trigger suggestion. */
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number]

/** Human labels for each lifecycle stage (library grouping + chips). */
export const LIFECYCLE_LABELS: Record<LifecycleStage, string> = {
  enquiry: 'Enquiry',
  quote: 'Quote',
  booking: 'Booking',
  planning: 'Planning',
  wedding_week: 'Wedding week',
  follow_up: 'Follow-up',
}

/** A saved email template owned by an MC. */
export interface EmailTemplate {
  id: string
  user_id: string
  name: string
  description: string | null
  /** Mustache subject, e.g. `Quote for {{couple.name}}`. */
  subject: string
  /** TipTap JSON body; mention nodes carry a namespaced variable key. */
  content: JSONContent
  lifecycle_stage: LifecycleStage | null
  is_starter: boolean
  position: number
  created_at: string
  updated_at: string
}

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

/**
 * Ordered lifecycle stages — mirrors the table's CHECK constraint.
 *
 * **Legacy**: grouping moved to user-editable categories
 * ({@link EmailTemplateCategory}); this column survives for starter
 * provenance and automation trigger suggestions only. New code should
 * read `category_id`.
 */
export const LIFECYCLE_STAGES = [
  'enquiry',
  'quote',
  'booking',
  'planning',
  'wedding_week',
  'follow_up',
] as const

/** A wedding-lifecycle stage tag (legacy — see {@link LIFECYCLE_STAGES}). */
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number]

/** Human labels for each lifecycle stage (starter catalog grouping). */
export const LIFECYCLE_LABELS: Record<LifecycleStage, string> = {
  enquiry: 'Enquiry',
  quote: 'Quote',
  booking: 'Booking',
  planning: 'Planning',
  wedding_week: 'Wedding week',
  follow_up: 'Follow-up',
}

/** Named palette keys a category can take (chip + dot classes map off these). */
export const CATEGORY_COLOR_KEYS = [
  'slate',
  'rose',
  'amber',
  'emerald',
  'sky',
  'violet',
  'pink',
  'stone',
] as const

/** A category's colour key. */
export type CategoryColor = (typeof CATEGORY_COLOR_KEYS)[number]

/**
 * A user-editable template category (Notion-style) — replaces the fixed
 * lifecycle stages for grouping the Emails library. Mirrors the
 * `email_template_categories` table.
 */
export interface EmailTemplateCategory {
  id: string
  user_id: string
  name: string
  color: CategoryColor
  position: number
  created_at: string
  updated_at: string
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
  /** Legacy stage tag — see {@link LIFECYCLE_STAGES}. UI uses `category_id`. */
  lifecycle_stage: LifecycleStage | null
  /** The user category this template is grouped under (null = uncategorised). */
  category_id: string | null
  is_starter: boolean
  position: number
  /** Soft retirement: set when archived (hidden from the library list and
   *  pickers, row kept); null = active. */
  archived_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Package domain types.
 *
 * Packages themselves are still typed locally by the Packages tab
 * manager (a `packages` row + derived counts); this module holds the
 * shared shapes other files need — currently the user-editable
 * category (mirrors the `package_categories` table, the same
 * Notion-style grouping email templates use).
 *
 * @module types/package
 */

import type { CategoryColor } from '@/types/email-template'

/**
 * A user-editable package category — same shape and palette as
 * {@link import('@/types/email-template').EmailTemplateCategory}, but a
 * separate table (`package_categories`): packages and emails have
 * different taxonomies, so their category lists stay independent.
 */
export interface PackageCategory {
  id: string
  user_id: string
  name: string
  color: CategoryColor
  position: number
  created_at: string
  updated_at: string
}

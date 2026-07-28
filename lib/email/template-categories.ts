/**
 * Default email-template categories + the lazy seeder.
 *
 * New users get the six historical lifecycle stages as editable
 * categories the first time the Templates page loads them. The seed is
 * guarded by `user_metadata.email_categories_initialized` so an MC who
 * deletes every category stays at zero — the defaults never respawn.
 * (Existing template owners were seeded + flagged by the
 * `20260709000000_email_template_categories` migration.)
 *
 * The flag lives in `user_metadata` deliberately: it's a UI preference,
 * not a trust/entitlement field, so the post-§7.4 `app_metadata` rule
 * doesn't apply.
 *
 * @module lib/email/template-categories
 */

import type { SupabaseClient, User } from '@supabase/supabase-js'

import type { Database } from '@/types/database'
import type { CategoryColor, LifecycleStage } from '@/types/email-template'

/** One seeded default (name/colour/order + the legacy stage it mirrors). */
export interface DefaultCategory {
  name: string
  color: CategoryColor
  position: number
  stage: LifecycleStage
}

/** The six defaults, mirroring the historical lifecycle stages. */
export const DEFAULT_EMAIL_CATEGORIES: readonly DefaultCategory[] = [
  { name: 'Enquiry', color: 'sky', position: 0, stage: 'enquiry' },
  { name: 'Quote', color: 'amber', position: 1, stage: 'quote' },
  { name: 'Booking', color: 'emerald', position: 2, stage: 'booking' },
  { name: 'Planning', color: 'violet', position: 3, stage: 'planning' },
  { name: 'Wedding week', color: 'rose', position: 4, stage: 'wedding_week' },
  { name: 'Follow-up', color: 'slate', position: 5, stage: 'follow_up' },
]

type CategoryRow = Database['public']['Tables']['email_template_categories']['Row']

/**
 * Seed the default categories for a first-time user (no-op behind the
 * initialised flag), then return every category the user has, ordered
 * by position. Both the category list query and the starter-template
 * add path call this so a fresh account always has somewhere to file
 * templates.
 */
export async function ensureDefaultCategories(
  supabase: SupabaseClient<Database>,
  user: User,
): Promise<CategoryRow[]> {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  if (meta['email_categories_initialized'] !== true) {
    // Name-conflict guard keeps a double-fire (two tabs racing) from
    // duplicating a default.
    const { data: existing } = await supabase
      .from('email_template_categories')
      .select('name')
      .eq('user_id', user.id)
    const have = new Set((existing ?? []).map((r) => r.name))
    const rows = DEFAULT_EMAIL_CATEGORIES.filter((d) => !have.has(d.name)).map((d) => ({
      user_id: user.id,
      name: d.name,
      color: d.color,
      position: d.position,
    }))
    if (rows.length > 0) await supabase.from('email_template_categories').insert(rows)
    await supabase.auth.updateUser({ data: { email_categories_initialized: true } })
  }

  const { data, error } = await supabase
    .from('email_template_categories')
    .select('*')
    .eq('user_id', user.id)
    .order('position', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

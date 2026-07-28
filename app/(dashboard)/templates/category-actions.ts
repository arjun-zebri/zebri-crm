/**
 * Server actions for email-template categories.
 *
 * Categories are the user-editable grouping for the Emails library
 * (create / rename / recolour / delete / reorder — the Notion pattern).
 * All actions are Zod-validated and RLS-scoped; deleting a category
 * leaves its templates uncategorised (`on delete set null`), never
 * deletes them.
 *
 * @module app/(dashboard)/templates/category-actions
 */
'use server'

import { z } from 'zod'

import { logger } from '@/lib/alerts/logger'
import { ensureDefaultCategories } from '@/lib/email/template-categories'
import { createClient } from '@/lib/supabase/server'
import { CATEGORY_COLOR_KEYS, type EmailTemplateCategory } from '@/types/email-template'

import type { ActionResult } from './actions'

const nameSchema = z.string().trim().min(1, 'Name is required').max(60)
const colorSchema = z.enum(CATEGORY_COLOR_KEYS)

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

/**
 * The caller's categories, ordered by position — seeding the six
 * defaults first for a brand-new account (guarded, never respawns).
 */
export async function listCategoriesAction(): Promise<ActionResult<EmailTemplateCategory[]>> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: 'Not signed in.' }
  try {
    const rows = await ensureDefaultCategories(supabase, user)
    return { ok: true, data: rows as EmailTemplateCategory[] }
  } catch (e) {
    logger.error('[templates/categories] list failed', e, { userId: user.id })
    return { ok: false, error: 'Could not load categories.' }
  }
}

/** Create a category (appended after the current last position). */
export async function createCategoryAction(input: {
  name: string
  color: string
}): Promise<ActionResult<EmailTemplateCategory>> {
  const parsed = z.object({ name: nameSchema, color: colorSchema }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid category.' }

  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { data: existing } = await supabase
    .from('email_template_categories')
    .select('position')
    .eq('user_id', user.id)
  const maxPosition = (existing ?? []).reduce((m, r) => Math.max(m, r.position), -1)

  const { data, error } = await supabase
    .from('email_template_categories')
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      color: parsed.data.color,
      position: maxPosition + 1,
    })
    .select('*')
    .single()
  if (error || !data) {
    logger.error('[templates/categories] create failed', error, { userId: user.id })
    return { ok: false, error: 'Could not create the category.' }
  }
  return { ok: true, data: data as EmailTemplateCategory }
}

/** Rename and/or recolour a category. */
export async function updateCategoryAction(input: {
  id: string
  name: string
  color: string
}): Promise<ActionResult<EmailTemplateCategory>> {
  const parsed = z.object({ id: z.uuid(), name: nameSchema, color: colorSchema }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid category.' }

  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { data, error } = await supabase
    .from('email_template_categories')
    .update({ name: parsed.data.name, color: parsed.data.color })
    .eq('id', parsed.data.id)
    .select('*')
    .single()
  if (error || !data) {
    logger.error('[templates/categories] update failed', error, { userId: user.id })
    return { ok: false, error: 'Could not save the category.' }
  }
  return { ok: true, data: data as EmailTemplateCategory }
}

/** Delete a category; its templates become uncategorised (FK set-null). */
export async function deleteCategoryAction(id: string): Promise<ActionResult<{ id: string }>> {
  const parsed = z.uuid().safeParse(id)
  if (!parsed.success) return { ok: false, error: 'Invalid category.' }

  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { error } = await supabase.from('email_template_categories').delete().eq('id', parsed.data)
  if (error) {
    logger.error('[templates/categories] delete failed', error, { userId: user.id })
    return { ok: false, error: 'Could not delete the category.' }
  }
  return { ok: true, data: { id: parsed.data } }
}

/**
 * Persist a drag-reorder: `ids` is the full category list in its new
 * order. Ids that aren't the caller's are no-ops under RLS.
 */
export async function reorderCategoriesAction(ids: string[]): Promise<ActionResult<null>> {
  const parsed = z.array(z.uuid()).min(1).max(100).safeParse(ids)
  if (!parsed.success) return { ok: false, error: 'Invalid order.' }

  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  // One update per row — category counts are small (a dozen at most),
  // and per-row updates keep this RLS-scoped with no RPC surface.
  for (const [index, id] of parsed.data.entries()) {
    const { error } = await supabase
      .from('email_template_categories')
      .update({ position: index })
      .eq('id', id)
    if (error) {
      logger.error('[templates/categories] reorder failed', error, { userId: user.id, id })
      return { ok: false, error: 'Could not reorder categories.' }
    }
  }
  return { ok: true, data: null }
}

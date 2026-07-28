/**
 * Server actions for the Templates surface (Email Templates feature).
 *
 * Every action is Zod-validated and runs through the RLS-scoped server
 * client (never the service role), returning a tagged
 * `{ ok, data } | { ok: false, error }` the hook pattern-matches.
 * These cover the library's create / update / delete / clone /
 * archive mutations plus adding starter templates from the catalog
 * by name.
 *
 * @module app/(dashboard)/templates/actions
 */
'use server'

import type { JSONContent } from '@tiptap/react'
import { z } from 'zod'

import { logger } from '@/lib/alerts/logger'
import { starterTemplatesByName } from '@/lib/email/starter-templates'
import { DEFAULT_EMAIL_CATEGORIES, ensureDefaultCategories } from '@/lib/email/template-categories'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import type { EmailTemplate } from '@/types/email-template'

/* ─── Tagged result type ───────────────────────────────────────── */

export interface ActionSuccess<T> {
  ok: true
  data: T
}
export interface ActionFailure {
  ok: false
  error: string
}
export type ActionResult<T> = ActionSuccess<T> | ActionFailure

/* ─── Schemas ──────────────────────────────────────────────────── */

const uuidSchema = z.uuid()

// TipTap JSON is structurally open; we accept any JSON object and let
// the renderer + sanitiser handle the shape defensively.
const contentSchema = z.record(z.string(), z.unknown())

const templateInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(500).default(''),
  subject: z.string().trim().max(300).default(''),
  content: contentSchema,
  // User category (replaces the legacy lifecycle_stage in the UI).
  // Ownership is verified before write — see `ownCategoryId`.
  category_id: z.uuid().nullable().default(null),
})

export type TemplateInput = z.input<typeof templateInputSchema>

type Row = Database['public']['Tables']['email_templates']['Row']

/** Map a DB row to the domain type (narrowing JSON → TipTap content). */
function toTemplate(row: Row): EmailTemplate {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description,
    subject: row.subject,
    content: (row.content ?? {}) as JSONContent,
    lifecycle_stage: row.lifecycle_stage as EmailTemplate['lifecycle_stage'],
    category_id: row.category_id,
    is_starter: row.is_starter,
    position: row.position,
    archived_at: row.archived_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

/**
 * Resolve a requested category id to one the caller owns, or `null`.
 * The FK alone doesn't prove ownership (it only proves existence), so
 * an RLS-scoped read is the gate — a foreign id quietly degrades to
 * "no category" instead of landing on someone else's category.
 */
async function ownCategoryId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryId: string | null,
): Promise<string | null> {
  if (!categoryId) return null
  const { data } = await supabase
    .from('email_template_categories')
    .select('id')
    .eq('id', categoryId)
    .maybeSingle()
  return data?.id ?? null
}

/* ─── createTemplateAction ─────────────────────────────────────── */

export async function createTemplateAction(
  input: TemplateInput,
): Promise<ActionResult<EmailTemplate>> {
  const parsed = templateInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid template data.' }

  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { data, error } = await supabase
    .from('email_templates')
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      subject: parsed.data.subject,
      content: parsed.data.content as Row['content'],
      category_id: await ownCategoryId(supabase, parsed.data.category_id),
    })
    .select('*')
    .single()

  if (error || !data) {
    logger.error('[templates/actions] createTemplateAction failed', error, { userId: user.id })
    return { ok: false, error: 'Could not create template.' }
  }
  return { ok: true, data: toTemplate(data) }
}

/* ─── updateTemplateAction ─────────────────────────────────────── */

export async function updateTemplateAction(
  id: string,
  input: TemplateInput,
): Promise<ActionResult<EmailTemplate>> {
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: 'Invalid template id.' }
  const parsed = templateInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid template data.' }

  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { data, error } = await supabase
    .from('email_templates')
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      subject: parsed.data.subject,
      content: parsed.data.content as Row['content'],
      category_id: await ownCategoryId(supabase, parsed.data.category_id),
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    logger.error('[templates/actions] updateTemplateAction failed', error, { userId: user.id, id })
    return { ok: false, error: 'Could not save template.' }
  }
  return { ok: true, data: toTemplate(data) }
}

/* ─── deleteTemplateAction ─────────────────────────────────────── */

export async function deleteTemplateAction(id: string): Promise<ActionResult<{ id: string }>> {
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: 'Invalid template id.' }

  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { error } = await supabase.from('email_templates').delete().eq('id', id)
  if (error) {
    logger.error('[templates/actions] deleteTemplateAction failed', error, { userId: user.id, id })
    return { ok: false, error: 'Could not delete template.' }
  }
  return { ok: true, data: { id } }
}

/* ─── setTemplateArchivedAction ────────────────────────────────── */

/**
 * Archive or restore a template (soft retirement). Archived templates
 * drop out of the Emails library list and the template pickers but
 * keep their row, so send history and automation references survive.
 */
export async function setTemplateArchivedAction(
  id: string,
  archived: boolean,
): Promise<ActionResult<EmailTemplate>> {
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: 'Invalid template id.' }

  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { data, error } = await supabase
    .from('email_templates')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id)
    .select('*')
    .single()
  if (error || !data) {
    logger.error('[templates/actions] setTemplateArchivedAction failed', error, { userId: user.id, id })
    return { ok: false, error: archived ? 'Could not archive template.' : 'Could not unarchive template.' }
  }
  return { ok: true, data: toTemplate(data) }
}

/* ─── cloneTemplateAction ──────────────────────────────────────── */

/** Duplicate an existing template (RLS guarantees same-owner only). */
export async function cloneTemplateAction(id: string): Promise<ActionResult<EmailTemplate>> {
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: 'Invalid template id.' }

  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { data: source, error: loadError } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', id)
    .single()
  if (loadError || !source) return { ok: false, error: 'Template not found.' }

  const { data, error } = await supabase
    .from('email_templates')
    .insert({
      user_id: user.id,
      name: `${source.name} (copy)`,
      description: source.description,
      subject: source.subject,
      content: source.content,
      lifecycle_stage: source.lifecycle_stage,
      category_id: source.category_id,
      position: source.position + 1,
    })
    .select('*')
    .single()

  if (error || !data) {
    logger.error('[templates/actions] cloneTemplateAction failed', error, { userId: user.id, id })
    return { ok: false, error: 'Could not clone template.' }
  }
  return { ok: true, data: toTemplate(data) }
}

/* ─── addStarterTemplatesAction ────────────────────────────────── */

const starterNamesSchema = z.array(z.string().trim().min(1)).min(1).max(50)

/**
 * Add starter templates from the catalog to the MC's library by name.
 *
 * Content is resolved **server-side** from the canonical catalog
 * (`starterTemplatesByName`) — the client only sends names, never body
 * JSON. Names the MC already has are skipped (so re-adding is a no-op),
 * and new rows are appended after the current max position and flagged
 * `is_starter` for provenance.
 *
 * @returns The number of templates actually inserted.
 */
export async function addStarterTemplatesAction(names: string[]): Promise<ActionResult<{ added: number }>> {
  const parsed = starterNamesSchema.safeParse(names)
  if (!parsed.success) return { ok: false, error: 'Invalid request.' }

  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const starters = starterTemplatesByName(parsed.data)
  if (starters.length === 0) return { ok: true, data: { added: 0 } }

  // Skip ones already in the library (by name) and append after the
  // current highest position.
  const { data: existing } = await supabase.from('email_templates').select('name, position').eq('user_id', user.id)
  const have = new Set((existing ?? []).map((r) => r.name))
  const maxPosition = (existing ?? []).reduce((m, r) => Math.max(m, r.position), 0)

  const toInsert = starters.filter((t) => !have.has(t.name))
  if (toInsert.length === 0) return { ok: true, data: { added: 0 } }

  // Starters carry a legacy lifecycle stage; file each one under the
  // user's matching default category (seeded here if this is a fresh
  // account) so they land grouped, not in "Uncategorised".
  const categories = await ensureDefaultCategories(supabase, user)
  const categoryByName = new Map(categories.map((c) => [c.name, c.id]))
  const stageCategory = (stage: string): string | null => {
    const def = DEFAULT_EMAIL_CATEGORIES.find((d) => d.stage === stage)
    return def ? (categoryByName.get(def.name) ?? null) : null
  }

  const rows = toInsert.map((t, i) => ({
    user_id: user.id,
    name: t.name,
    description: t.description,
    subject: t.subject,
    content: t.content as NonNullable<Database['public']['Tables']['email_templates']['Insert']['content']>,
    lifecycle_stage: t.lifecycleStage,
    category_id: stageCategory(t.lifecycleStage),
    is_starter: true,
    position: maxPosition + (i + 1) * 10,
  }))

  const { error } = await supabase.from('email_templates').insert(rows)
  if (error) {
    logger.error('[templates/actions] addStarterTemplatesAction failed', error, { userId: user.id })
    return { ok: false, error: 'Could not add templates.' }
  }
  return { ok: true, data: { added: rows.length } }
}

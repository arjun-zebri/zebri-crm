/**
 * Server actions for the Templates surface (Email Templates feature).
 *
 * Every action is Zod-validated and runs through the RLS-scoped server
 * client (never the service role), returning a tagged
 * `{ ok, data } | { ok: false, error }` the hook pattern-matches.
 * Listing + seeding happen in the server `page.tsx`; these cover the
 * library's create / update / delete / clone mutations.
 *
 * @module app/(dashboard)/templates/actions
 */
'use server'

import type { JSONContent } from '@tiptap/react'
import { z } from 'zod'

import { logger } from '@/lib/alerts/logger'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { LIFECYCLE_STAGES, type EmailTemplate } from '@/types/email-template'

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
  lifecycle_stage: z.enum(LIFECYCLE_STAGES).nullable().default(null),
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
    is_starter: row.is_starter,
    position: row.position,
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
      lifecycle_stage: parsed.data.lifecycle_stage,
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
      lifecycle_stage: parsed.data.lifecycle_stage,
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

/**
 * Server actions for email-template attachments.
 *
 * The binary uploads straight from the browser to the private
 * `email-template-files` bucket (server-action bodies are too small for
 * 25 MB files; the bucket's RLS policies + size/MIME limits are the
 * enforcement boundary). These actions manage the metadata rows: the
 * storage path is **derived server-side** from the session user + the
 * validated ids, so a client can never register a path it doesn't own,
 * and the template's ownership is checked before any row lands.
 *
 * @module app/(dashboard)/templates/attachment-actions
 */
'use server'

import { z } from 'zod'

import { logger } from '@/lib/alerts/logger'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

import type { ActionResult } from './actions'

/** Mirrors the bucket's `allowed_mime_types` so failures are friendly. */
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
] as const

/** Mirrors the bucket's 25 MB `file_size_limit`. */
const MAX_FILE_SIZE = 26214400

const registerSchema = z.object({
  /** `null` = a draft upload for an unsaved template; linked on save. */
  templateId: z.uuid().nullable(),
  /** Client-generated object id — the last path segment of the upload. */
  fileId: z.uuid(),
  fileName: z.string().trim().min(1).max(200),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE),
  mimeType: z.enum(ALLOWED_MIME_TYPES),
})

export type TemplateFileRow = Database['public']['Tables']['email_template_files']['Row']

/**
 * Record an uploaded attachment. With a `templateId` the caller must own
 * the template (RLS-scoped read); with `null` the row is a **draft**
 * upload for an unsaved template, parked unlinked and pointed at the
 * template later by {@link linkTemplateFilesAction}. Either way the
 * binary must already be at the derived storage path — this action never
 * trusts a client-supplied path (drafts live under `{user_id}/drafts/`).
 */
export async function registerTemplateFileAction(
  input: z.input<typeof registerSchema>,
): Promise<ActionResult<TemplateFileRow>> {
  const parsed = registerSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid attachment' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  // Ownership gate: an RLS-scoped read returns nothing for a template
  // the caller doesn't own, so a foreign templateId can't be attached to.
  if (parsed.data.templateId !== null) {
    const { data: template } = await supabase
      .from('email_templates')
      .select('id')
      .eq('id', parsed.data.templateId)
      .maybeSingle()
    if (!template) return { ok: false, error: 'Template not found' }
  }

  const storagePath = `${user.id}/${parsed.data.templateId ?? 'drafts'}/${parsed.data.fileId}`
  const { data, error } = await supabase
    .from('email_template_files')
    .insert({
      id: parsed.data.fileId,
      user_id: user.id,
      template_id: parsed.data.templateId,
      file_name: parsed.data.fileName,
      file_size: parsed.data.fileSize,
      mime_type: parsed.data.mimeType,
      storage_path: storagePath,
    })
    .select('*')
    .single()

  if (error || !data) {
    logger.error('[templates/attachments] register failed', { userId: user.id, error: error?.message })
    return { ok: false, error: 'Could not save the attachment' }
  }
  return { ok: true, data }
}

/**
 * Point draft uploads (template_id null) at a just-saved template.
 * Only unlinked rows move — a file already on another template can't be
 * re-parented — and the target template's ownership is checked first.
 */
export async function linkTemplateFilesAction(
  templateId: string,
  fileIds: string[],
): Promise<ActionResult<null>> {
  const parsed = z
    .object({ templateId: z.uuid(), fileIds: z.array(z.uuid()).min(1).max(10) })
    .safeParse({ templateId, fileIds })
  if (!parsed.success) return { ok: false, error: 'Invalid attachments' }

  const supabase = await createClient()
  const { data: template } = await supabase
    .from('email_templates')
    .select('id')
    .eq('id', parsed.data.templateId)
    .maybeSingle()
  if (!template) return { ok: false, error: 'Template not found' }

  const { error } = await supabase
    .from('email_template_files')
    .update({ template_id: parsed.data.templateId })
    .in('id', parsed.data.fileIds)
    .is('template_id', null)
  if (error) {
    logger.error('[templates/attachments] link failed', { templateId, error: error.message })
    return { ok: false, error: 'Could not attach the files' }
  }
  return { ok: true, data: null }
}

/**
 * Delete an attachment: the storage object first, then the metadata
 * row. Both are RLS-scoped, so a foreign file id is a silent no-op.
 */
export async function deleteTemplateFileAction(fileId: string): Promise<ActionResult<null>> {
  const parsed = z.uuid().safeParse(fileId)
  if (!parsed.success) return { ok: false, error: 'Invalid file' }

  const supabase = await createClient()
  const { data: row } = await supabase
    .from('email_template_files')
    .select('id, storage_path')
    .eq('id', parsed.data)
    .maybeSingle()
  if (!row) return { ok: false, error: 'Attachment not found' }

  // Best-effort object removal — a dangling object is preferable to a
  // dangling metadata row (the row is what sends attach from).
  await supabase.storage.from('email-template-files').remove([row.storage_path])

  const { error } = await supabase.from('email_template_files').delete().eq('id', row.id)
  if (error) {
    logger.error('[templates/attachments] delete failed', { fileId: row.id, error: error.message })
    return { ok: false, error: 'Could not remove the attachment' }
  }
  return { ok: true, data: null }
}

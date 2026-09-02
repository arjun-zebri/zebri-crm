/**
 * Zod schemas for the script server actions.
 *
 * Kept in a plain module (not a `'use server'` file) because Next only allows
 * async functions as exports from server-action files; a schema exported from
 * one crashes at runtime.
 *
 * @module lib/documents/script-schemas
 */
import type { JSONContent } from '@tiptap/core'
import { z } from 'zod'

import { SCRIPT_FONT_IDS, type ScriptFontId } from './script-fonts'

/** Largest accepted script body, as serialised JSON bytes. Generous for prose; blocks a runaway payload. */
export const SCRIPT_CONTENT_MAX_BYTES = 1_000_000

/** Script title: trimmed, one to 120 characters. */
export const scriptTitleSchema = z.string().trim().min(1, 'Title is required').max(120)

/** Base font id: must be in the catalogue. */
export const scriptFontSchema = z.enum(SCRIPT_FONT_IDS)


/**
 * A TipTap document. Shape is validated loosely (root `doc` with a `content`
 * array); the extension allowlist and the sanitizer bound what any node can
 * become when rendered. Size is capped by serialised length.
 */
export const scriptContentSchema = z
  .object({ type: z.literal('doc'), content: z.array(z.record(z.string(), z.unknown())).optional() })
  .passthrough()
  .refine((doc) => JSON.stringify(doc).length <= SCRIPT_CONTENT_MAX_BYTES, 'Script is too large')

export const createScriptSchema = z.object({
  couple_id: z.uuid(),
  title: scriptTitleSchema.optional(),
})

export const updateScriptSchema = z
  .object({
    id: z.uuid(),
    title: scriptTitleSchema.optional(),
    content: scriptContentSchema.optional(),
    font: scriptFontSchema.optional(),
  })
  .refine((u) => u.title !== undefined || u.content !== undefined || u.font !== undefined, 'Nothing to update')

export const deleteScriptSchema = z.object({ id: z.uuid() })

export const duplicateScriptSchema = z.object({ id: z.uuid() })

export type CreateScriptInput = z.input<typeof createScriptSchema>

/**
 * Update payload as callers build it. `content` is typed as TipTap's
 * `JSONContent` (what the editor emits) rather than the schema's narrower
 * literal shape; the schema validates the root at runtime.
 */
export interface UpdateScriptInput {
  id: string
  title?: string
  content?: JSONContent
  font?: ScriptFontId
}

/**
 * Zod input schemas for the template server actions. A plain module (not
 * `'use server'`) because value exports from an actions file crash at
 * runtime (memory: use_server_value_exports).
 *
 * @module features/proposals/data/template-schemas
 */
import { z } from 'zod'

import { proposalLayoutSchema } from '../model/schema'

/** The three proposal-role starters a fresh template can be built from. */
export const roleSchema = z.enum(['mc', 'celebrant', 'both'])
/** A template id, as passed to every single-template action. */
export const idSchema = z.object({ id: z.string().uuid() })
/** Input to `createTemplateAction`. */
export const createTemplateSchema = z.object({ name: z.string().trim().min(1).max(80), layout: proposalLayoutSchema.optional(), role: roleSchema.optional() })
/**
 * Input to `updateTemplateLayoutAction` and the layout beacon route.
 * `baseRevision` is the `revision` the client loaded (or last had
 * confirmed): the write only lands if the row still carries it.
 */
export const updateTemplateLayoutSchema = z.object({ id: z.string().uuid(), layout: proposalLayoutSchema, baseRevision: z.number().int().min(0) })
/** Input to `renameTemplateAction`. */
export const renameTemplateSchema = z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(80) })
/** Input to `duplicateTemplateAction`. */
export const duplicateTemplateSchema = z.object({ id: z.string().uuid() })

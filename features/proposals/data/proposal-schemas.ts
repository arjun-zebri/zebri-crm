/**
 * Zod input schemas for the per-proposal layout actions. A plain module
 * (not `'use server'`) because value exports from an actions file crash at
 * runtime (memory: use_server_value_exports).
 *
 * @module features/proposals/data/proposal-schemas
 */
import { z } from 'zod'

import { proposalLayoutSchema } from '../model/schema'

/** A proposal id, as passed to every single-proposal action. */
export const proposalIdSchema = z.object({ id: z.string().uuid() })

/**
 * Input to `updateProposalLayoutAction`. `baseRevision` is the
 * `layoutRevision` the client loaded (or last had confirmed): the write
 * only lands if the row still carries it. Same guard, same shape as
 * `updateTemplateLayoutSchema`, one table over.
 */
export const updateProposalLayoutSchema = z.object({ id: z.string().uuid(), layout: proposalLayoutSchema, baseRevision: z.number().int().min(0) })

/** Input to `renameProposalAction`. 200 chars matches the `title` limit `saveProposalSchema` already enforces. */
export const renameProposalSchema = z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(200) })

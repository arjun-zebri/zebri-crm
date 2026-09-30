'use server'

/**
 * Server actions for one proposal's own design: the copy of the template
 * layout that `createProposalFromTemplateAction` snapshots into
 * `proposals.layout` (roadmap R3 §6.1, "Edit"). The proposal editor mounts
 * on these three the way the template editor mounts on `./templates.ts`,
 * and they deliberately mirror that module: same `currentUserId` helper,
 * same tagged results, same compare-and-set conflict shape, one table over.
 *
 * @module features/proposals/data/proposals
 */
import { logger } from '@/lib/alerts/logger'
import { createClient } from '@/lib/supabase/server'
import { toPlainJSON } from '@/lib/utils'
import type { Json } from '@/types/database'

import type { ProposalLayout } from '../model/layout'
import { parseProposalLayout } from '../model/schema'

import { proposalIdSchema, renameProposalSchema, updateProposalLayoutSchema } from './proposal-schemas'
import { resyncProposalOptions } from './resync-options'
import type { SaveLayoutResult } from './templates'

/**
 * One proposal's design: what the layout editor mounts on. The couple's
 * name rides along because every variable chip in the layout resolves
 * against it, so the editor would otherwise need a second round trip
 * before it could render a single section.
 */
export interface ProposalDesignRecord {
  id: string
  title: string
  status: string
  layout: ProposalLayout
  layoutRevision: number
  coupleId: string
  coupleName: string
  /**
   * The name of the template this proposal was copied from, or `null` when
   * it was not created from one. The editor header says it out loud, so
   * that an MC editing a couple's copy can see which template they are
   * *not* changing.
   */
  templateName: string | null
  expiresAt: string | null
}

type Fail = { ok: false; error: string }

/** The columns every read below selects, so the row shape has one source of truth. */
const RECORD_COLUMNS = 'id, title, status, layout, layout_revision, couple_id, expires_at, couples(name), proposal_templates(name)'

/** Resolve the signed-in user for an action, or a tagged failure when there is none. */
async function currentUserId(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; userId: string } | Fail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }
  return { supabase, userId: user.id }
}

/**
 * Load one proposal's design.
 *
 * A proposal with no `layout` at all (created before R3, or by the legacy
 * builder) is not an error worth showing: the caller falls back to the v1
 * modal on this exact message.
 */
export async function getProposalDesignAction(id: string): Promise<{ ok: true; proposal: ProposalDesignRecord } | Fail> {
  const input = proposalIdSchema.safeParse({ id })
  if (!input.success) return { ok: false, error: 'Invalid proposal id' }
  const ctx = await currentUserId()
  if ('ok' in ctx) return ctx
  const { data, error } = await ctx.supabase.from('proposals').select(RECORD_COLUMNS).eq('id', input.data.id).maybeSingle()
  if (error) {
    // Never surface a raw Postgres error to the client; log it for triage
    // and return a short generic string.
    logger.error('proposal_design_get_failed', error, { userId: ctx.userId, proposalId: input.data.id })
    return { ok: false, error: 'Could not load the proposal' }
  }
  if (!data) return { ok: false, error: 'Proposal not found' }
  if (data.layout === null) return { ok: false, error: 'This proposal has no design yet' }
  const parsed = parseProposalLayout(data.layout)
  if (!parsed.ok) {
    logger.error('proposal_design_invalid_layout', new Error(parsed.issues[0] ?? 'unknown'), { userId: ctx.userId, proposalId: input.data.id })
    return { ok: false, error: `Stored proposal design is invalid: ${parsed.issues[0] ?? 'unknown'}` }
  }
  return {
    ok: true,
    proposal: {
      id: data.id, title: data.title, status: data.status, layout: parsed.layout,
      layoutRevision: data.layout_revision, coupleId: data.couple_id,
      coupleName: data.couples?.name ?? '', templateName: data.proposal_templates?.name ?? null,
      expiresAt: data.expires_at,
    },
  }
}

/**
 * Replace a proposal's layout wholesale (the editor autosave path),
 * guarded by `baseRevision` exactly as `updateTemplateLayoutAction` guards
 * a template's: the update only matches a row still at that revision and
 * bumps it by one, and a miss hands the client the current row to
 * reconcile against instead of overwriting it.
 *
 * An accepted proposal is frozen: the contract and the invoice were built
 * from the design the couple said yes to, so the `.neq` below is what
 * actually enforces it, not a read-then-write the couple could accept in
 * between.
 */
export async function updateProposalLayoutAction(raw: unknown): Promise<SaveLayoutResult> {
  const input = updateProposalLayoutSchema.safeParse(raw)
  if (!input.success) return { ok: false, error: input.error.issues[0]?.message ?? 'Invalid layout' }
  const ctx = await currentUserId()
  if ('ok' in ctx) return ctx
  const { id, baseRevision } = input.data
  const nextRevision = baseRevision + 1
  const { error, count } = await ctx.supabase
    .from('proposals')
    .update({ layout: toPlainJSON(input.data.layout) as unknown as Json, layout_revision: nextRevision, updated_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', id)
    .eq('layout_revision', baseRevision)
    .neq('status', 'accepted')
  if (error) {
    logger.error('proposal_update_layout_failed', error, { userId: ctx.userId, proposalId: id })
    return { ok: false, error: 'Could not save the proposal' }
  }
  if (count) {
    // The design is saved; now bring the couple's own option rows back in
    // step with the packages section the MC just edited. Never throws and
    // never fails the save: see `resyncProposalOptions`.
    // The same cast `parseProposalLayout` makes on its own `safeParse`
    // result: Zod infers the rich-doc nodes structurally, which TipTap's
    // `JSONContent` (with its index signature) is not assignable from.
    const layout = input.data.layout as ProposalLayout
    await resyncProposalOptions(ctx.supabase, { proposalId: id, userId: ctx.userId, layout })
    return { ok: true, revision: nextRevision }
  }
  // Zero rows: the id is not ours / gone, the proposal is accepted, or the
  // revision moved on. A second read tells them apart and hands the client
  // the current row in the conflict case.
  const { data: current, error: readError } = await ctx.supabase.from('proposals').select('status, layout, layout_revision').eq('id', id).maybeSingle()
  if (readError) {
    logger.error('proposal_update_layout_failed', readError, { userId: ctx.userId, proposalId: id, stage: 'conflict-read' })
    return { ok: false, error: 'Could not save the proposal' }
  }
  if (!current) return { ok: false, error: 'Proposal not found' }
  if (current.status === 'accepted') return { ok: false, error: 'This proposal has been accepted and can no longer be edited' }
  const parsed = current.layout === null ? null : parseProposalLayout(current.layout)
  if (!parsed?.ok) return { ok: false, error: 'Proposal changed elsewhere' }
  return { ok: false, error: 'Proposal changed elsewhere', conflict: { revision: current.layout_revision, layout: parsed.layout } }
}

/** Rename a proposal. The title is what the couple sees at the top of the page and in the email subject. */
export async function renameProposalAction(raw: unknown): Promise<{ ok: true } | Fail> {
  const input = renameProposalSchema.safeParse(raw)
  if (!input.success) return { ok: false, error: 'Invalid title' }
  const ctx = await currentUserId()
  if ('ok' in ctx) return ctx
  const { error, count } = await ctx.supabase.from('proposals').update({ title: input.data.title, updated_at: new Date().toISOString() }, { count: 'exact' }).eq('id', input.data.id)
  if (error) {
    logger.error('proposal_rename_failed', error, { userId: ctx.userId, proposalId: input.data.id })
    return { ok: false, error: 'Could not rename the proposal' }
  }
  if (!count) return { ok: false, error: 'Proposal not found' }
  return { ok: true }
}

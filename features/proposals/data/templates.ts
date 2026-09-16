'use server'

/**
 * Server actions for `proposal_templates` (spec §2.3, §5.1). Every action
 * runs as the signed-in user (RLS applies), validates its input with Zod,
 * and returns a tagged result rather than throwing. `ensureDefaultTemplate`
 * is also the lazy v1 → v2 migration for the account's proposal tree
 * (spec §7, D13): the v1 tree is kept in `blocks_proposal_v1_backup` for
 * 30 days.
 *
 * @module features/proposals/data/templates
 */
import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { logger } from '@/lib/alerts/logger'
import { repairBlocks } from '@/lib/branding/validate-blocks'
import { createClient } from '@/lib/supabase/server'
import { toPlainJSON } from '@/lib/utils'
import type { Json } from '@/types/database'

import type { ProposalLayout } from '../model/layout'
import { isLayoutV2, migrateProposalTreeToLayout } from '../model/migrate-v1'
import { defaultTemplateLayout } from '../model/presets'
import { parseProposalLayout } from '../model/schema'

import { createTemplateSchema, idSchema, renameTemplateSchema, roleSchema, updateTemplateLayoutSchema } from './template-schemas'

/** A template's list-row shape: enough to render a picker without the layout payload. */
export interface TemplateSummary { id: string; name: string; isDefault: boolean; updatedAt: string }
/** A single template including its full, validated layout. */
export interface TemplateRecord extends TemplateSummary { layout: ProposalLayout }
type Fail = { ok: false; error: string }

const DEFAULT_NAME = 'My proposal'

/** Resolve the signed-in user for an action, or a tagged failure when there is none. */
async function currentUserId(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; userId: string } | Fail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }
  return { supabase, userId: user.id }
}

/** Parse a DB row's `layout` jsonb into a validated {@link ProposalLayout}, or fail. */
function toRecord(row: { id: string; name: string; is_default: boolean; updated_at: string; layout: Json }): TemplateRecord | Fail {
  const parsed = parseProposalLayout(row.layout)
  if (!parsed.ok) return { ok: false, error: `Stored template is invalid: ${parsed.issues[0] ?? 'unknown'}` }
  return { id: row.id, name: row.name, isDefault: row.is_default, updatedAt: row.updated_at, layout: parsed.layout }
}

/** List every template the signed-in user owns, default first, newest first. */
export async function listTemplatesAction(): Promise<{ ok: true; templates: TemplateSummary[] } | Fail> {
  const ctx = await currentUserId()
  if ('ok' in ctx) return ctx
  const { data, error } = await ctx.supabase.from('proposal_templates').select('id, name, is_default, updated_at').order('is_default', { ascending: false }).order('updated_at', { ascending: false })
  if (error) {
    // Never surface a raw Postgres error to the client (may name columns /
    // constraints); log it for triage and return a short generic string.
    logger.error('proposal_templates_list_failed', error, { userId: ctx.userId })
    return { ok: false, error: 'Could not load your templates' }
  }
  return { ok: true, templates: data.map((t) => ({ id: t.id, name: t.name, isDefault: t.is_default, updatedAt: t.updated_at })) }
}

/** Fetch one template (with its layout) by id. */
export async function getTemplateAction(id: string): Promise<{ ok: true; template: TemplateRecord } | Fail> {
  const input = idSchema.safeParse({ id })
  if (!input.success) return { ok: false, error: 'Invalid template id' }
  const ctx = await currentUserId()
  if ('ok' in ctx) return ctx
  const { data, error } = await ctx.supabase.from('proposal_templates').select('id, name, is_default, updated_at, layout').eq('id', input.data.id).single()
  if (error || !data) return { ok: false, error: 'Template not found' }
  const record = toRecord(data)
  return 'ok' in record ? record : { ok: true, template: record }
}

/** Create a new template. The first template a user ever creates becomes the default. */
export async function createTemplateAction(raw: unknown): Promise<{ ok: true; template: TemplateRecord } | Fail> {
  const input = createTemplateSchema.safeParse(raw)
  if (!input.success) return { ok: false, error: input.error.issues[0]?.message ?? 'Invalid input' }
  const ctx = await currentUserId()
  if ('ok' in ctx) return ctx
  const layout = (input.data.layout ?? defaultTemplateLayout(input.data.role ?? 'mc')) as ProposalLayout
  const { count } = await ctx.supabase.from('proposal_templates').select('id', { count: 'exact', head: true })
  const { data, error } = await ctx.supabase
    .from('proposal_templates')
    .insert({ user_id: ctx.userId, name: input.data.name, layout: toPlainJSON(layout) as unknown as Json, is_default: (count ?? 0) === 0 })
    .select('id, name, is_default, updated_at, layout')
    .single()
  if (error || !data) {
    if (error) logger.error('proposal_templates_create_failed', error, { userId: ctx.userId })
    return { ok: false, error: 'Could not create the template' }
  }
  const record = toRecord(data)
  return 'ok' in record ? record : { ok: true, template: record }
}

/** Replace a template's layout wholesale (the editor autosave path). */
export async function updateTemplateLayoutAction(raw: unknown): Promise<{ ok: true } | Fail> {
  const input = updateTemplateLayoutSchema.safeParse(raw)
  if (!input.success) return { ok: false, error: input.error.issues[0]?.message ?? 'Invalid layout' }
  const ctx = await currentUserId()
  if ('ok' in ctx) return ctx
  const { error, count } = await ctx.supabase
    .from('proposal_templates')
    .update({ layout: toPlainJSON(input.data.layout) as unknown as Json, updated_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', input.data.id)
  if (error) {
    logger.error('proposal_templates_update_layout_failed', error, { userId: ctx.userId })
    return { ok: false, error: 'Could not save the template' }
  }
  if (!count) return { ok: false, error: 'Template not found' }
  return { ok: true }
}

/** Rename a template. */
export async function renameTemplateAction(raw: unknown): Promise<{ ok: true } | Fail> {
  const input = renameTemplateSchema.safeParse(raw)
  if (!input.success) return { ok: false, error: 'Invalid name' }
  const ctx = await currentUserId()
  if ('ok' in ctx) return ctx
  const { error, count } = await ctx.supabase.from('proposal_templates').update({ name: input.data.name, updated_at: new Date().toISOString() }, { count: 'exact' }).eq('id', input.data.id)
  if (error) {
    logger.error('proposal_templates_rename_failed', error, { userId: ctx.userId })
    return { ok: false, error: 'Could not rename the template' }
  }
  if (!count) return { ok: false, error: 'Template not found' }
  return { ok: true }
}

/**
 * Make a template the account's default, clearing the previous one.
 *
 * The clear-then-set below is two statements, not one transaction, so the
 * target is verified to exist FIRST: clearing the current default before
 * confirming the target is real would leave the account with no default at
 * all on an unknown/foreign id (and `ensureDefaultTemplateAction` would then
 * treat that as "no templates" and re-run the v1 migration). Verifying
 * first closes that hole except for a crash between the verify and the
 * clear/set pair, which `ensureDefaultTemplateAction`'s promote-the-latest
 * fallback repairs. A single-statement `set_default_proposal_template(uuid)`
 * RPC that does this atomically is deferred to Phase 2.
 */
export async function setDefaultTemplateAction(raw: unknown): Promise<{ ok: true } | Fail> {
  const input = idSchema.safeParse(raw)
  if (!input.success) return { ok: false, error: 'Invalid template id' }
  const ctx = await currentUserId()
  if ('ok' in ctx) return ctx
  const { data: target, error: findError } = await ctx.supabase.from('proposal_templates').select('id, is_default').eq('id', input.data.id).maybeSingle()
  if (findError) {
    logger.error('proposal_templates_set_default_failed', findError, { userId: ctx.userId, stage: 'find' })
    return { ok: false, error: 'Could not set the default template' }
  }
  if (!target) return { ok: false, error: 'Template not found' }
  if (target.is_default) return { ok: true }
  // Two statements: the partial unique index refuses a second default, so
  // the old one is cleared first. RLS scopes both to the user.
  const clear = await ctx.supabase.from('proposal_templates').update({ is_default: false }).eq('is_default', true)
  if (clear.error) {
    logger.error('proposal_templates_set_default_failed', clear.error, { userId: ctx.userId, stage: 'clear' })
    return { ok: false, error: 'Could not set the default template' }
  }
  const { error, count } = await ctx.supabase.from('proposal_templates').update({ is_default: true }, { count: 'exact' }).eq('id', input.data.id)
  if (error) {
    logger.error('proposal_templates_set_default_failed', error, { userId: ctx.userId, stage: 'set' })
    return { ok: false, error: 'Could not set the default template' }
  }
  if (!count) return { ok: false, error: 'Template not found' }
  return { ok: true }
}

/** Delete a template. Refuses to delete the default, or the account's last remaining template. */
export async function deleteTemplateAction(raw: unknown): Promise<{ ok: true } | Fail> {
  const input = idSchema.safeParse(raw)
  if (!input.success) return { ok: false, error: 'Invalid template id' }
  const ctx = await currentUserId()
  if ('ok' in ctx) return ctx
  const { data: rows } = await ctx.supabase.from('proposal_templates').select('id, is_default')
  const target = rows?.find((r) => r.id === input.data.id)
  if (!target) return { ok: false, error: 'Template not found' }
  if (target.is_default) return { ok: false, error: 'Make another template the default before deleting this one' }
  if ((rows?.length ?? 0) <= 1) return { ok: false, error: 'You need at least one template' }
  const { error } = await ctx.supabase.from('proposal_templates').delete().eq('id', input.data.id)
  if (error) {
    logger.error('proposal_templates_delete_failed', error, { userId: ctx.userId })
    return { ok: false, error: 'Could not delete the template' }
  }
  return { ok: true }
}

/**
 * Return the account's default template, creating it on first use.
 *
 * Three cases, in order:
 * 1. A default already exists: return it as-is.
 * 2. No default, but the account has at least one template (this only
 *    happens if a `setDefaultTemplateAction` call crashed between clearing
 *    the old default and setting the new one): promote the most recently
 *    updated template rather than re-running the migration, which would
 *    otherwise silently overwrite `blocks_proposal_v1_backup` and insert a
 *    second "My proposal".
 * 3. No templates at all (spec §7, D13, the lazy migration): reads
 *    `user_branding.branding_blocks->'proposal'`. A v1 block tree there is
 *    repaired then migrated to a v2 layout, the original tree is copied
 *    into `blocks_proposal_v1_backup` (kept 30 days), and the result
 *    becomes the new default template named "My proposal". A user with no
 *    v1 tree at all instead gets the role's starter layout, chosen by
 *    precedence: the caller-supplied `roleRaw`, else the role the MC
 *    already chose and persisted at `user_branding.proposal_role` (the
 *    branding editor's role chooser writes this - see
 *    `app/(dashboard)/branding/proposal-role-actions.ts`), else `'mc'`.
 *
 * Idempotent: once a default exists, later calls just return it.
 */
export async function ensureDefaultTemplateAction(roleRaw?: unknown): Promise<{ ok: true; template: TemplateRecord; migratedFromV1: boolean } | Fail> {
  const callerRole = roleSchema.safeParse(roleRaw)
  const ctx = await currentUserId()
  if ('ok' in ctx) return ctx
  const { data: existing } = await ctx.supabase.from('proposal_templates').select('id, name, is_default, updated_at, layout').eq('is_default', true).maybeSingle()
  if (existing) {
    const record = toRecord(existing)
    return 'ok' in record ? record : { ok: true, template: record, migratedFromV1: false }
  }

  // Case 2: no default, but a template exists (a crash mid `setDefault`).
  // Promote it instead of touching the migration/backup path at all.
  const { data: orphan } = await ctx.supabase.from('proposal_templates').select('id, name, is_default, updated_at, layout').order('updated_at', { ascending: false }).limit(1).maybeSingle()
  if (orphan) {
    const { error: promoteError, count } = await ctx.supabase.from('proposal_templates').update({ is_default: true }, { count: 'exact' }).eq('id', orphan.id)
    if (promoteError || !count) {
      logger.error('proposal_templates_ensure_default_failed', promoteError, { userId: ctx.userId, stage: 'promote' })
      return { ok: false, error: 'Could not set the default template' }
    }
    const record = toRecord({ ...orphan, is_default: true })
    return 'ok' in record ? record : { ok: true, template: record, migratedFromV1: false }
  }

  const { data: branding } = await ctx.supabase.from('user_branding').select('branding_blocks, proposal_role').eq('user_id', ctx.userId).maybeSingle()
  const v1 = (branding?.branding_blocks as { proposal?: unknown } | null)?.proposal
  // Precedence: an explicit caller-supplied role wins (e.g. onboarding's
  // just-chosen role, not yet persisted); otherwise the persisted role is
  // re-validated against the known set (roleSchema) rather than trusted as
  // stored, since a legacy or corrupted row could hold anything.
  const persistedRole = roleSchema.safeParse(branding?.proposal_role)
  const role = callerRole.success ? callerRole.data : persistedRole.success ? persistedRole.data : 'mc'
  let layout: ProposalLayout
  let migratedFromV1 = false
  // Whenever the account has a real v1 tree, it is backed up before the
  // template is inserted, independent of whether the migration or the
  // resulting parse succeeds: a v1 tree that fails migration or fails
  // validation still falls back to the role starter below, and losing the
  // account's own design at that point (with no backup to recover it from)
  // would break the "never lose what the MC built" promise on exactly the
  // path where something already went wrong.
  const hasV1Tree = Array.isArray(v1) && v1.length > 0
  if (hasV1Tree) {
    try {
      // The v1 value read back from jsonb is `unknown`; repairBlocks is the
      // sanctioned normaliser (legacy shapes, unknown types, marker dedup)
      // before the migration sees it, so the cast happens right here.
      layout = migrateProposalTreeToLayout(repairBlocks('proposal', v1 as Block[]))
      migratedFromV1 = true
    } catch (err) {
      // A malformed v1 tree must never break onboarding: fall back to the
      // role starter, same as an invalid-parse result below.
      logger.error('proposal_template_migration_threw', err, { userId: ctx.userId })
      layout = defaultTemplateLayout(role)
    }
  } else if (isLayoutV2(v1)) {
    layout = v1
  } else {
    layout = defaultTemplateLayout(role)
  }
  const parsed = parseProposalLayout(layout)
  if (!parsed.ok) {
    // Migration produced something the v2 schema rejects: fall back to the
    // role starter rather than fail the whole action, but keep a record so
    // the bad tree can be investigated (it is never the user's fault). The
    // starter is what actually becomes the default template, so the
    // returned `migratedFromV1` must say so too, even though `hasV1Tree`
    // (below) still backs up the original tree.
    logger.error('proposal_template_migration_invalid', undefined, { userId: ctx.userId, issues: parsed.issues.slice(0, 5) })
    layout = defaultTemplateLayout(role)
    migratedFromV1 = false
  }

  if (hasV1Tree) {
    // Backed up BEFORE the template is inserted: if the process crashes
    // between the two writes, the v1 tree is never lost (a retry re-reads
    // the same `v1` value and overwrites the backup with identical
    // content, which is harmless), whereas losing the backup after the
    // template exists would leave no way back to the original design.
    const { error } = await ctx.supabase.from('user_branding')
      .update({ blocks_proposal_v1_backup: v1 as Json, blocks_proposal_v1_backup_at: new Date().toISOString() })
      .eq('user_id', ctx.userId)
    if (error) {
      logger.error('proposal_templates_backup_failed', error, { userId: ctx.userId })
      return { ok: false, error: 'Could not back up the current design' }
    }
  }
  const { data, error } = await ctx.supabase
    .from('proposal_templates')
    .insert({ user_id: ctx.userId, name: DEFAULT_NAME, layout: toPlainJSON(layout) as unknown as Json, is_default: true })
    .select('id, name, is_default, updated_at, layout')
    .single()
  if (error || !data) {
    if (error) logger.error('proposal_templates_ensure_default_failed', error, { userId: ctx.userId, stage: 'insert' })
    return { ok: false, error: 'Could not create the default template' }
  }
  const record = toRecord(data)
  return 'ok' in record ? record : { ok: true, template: record, migratedFromV1 }
}

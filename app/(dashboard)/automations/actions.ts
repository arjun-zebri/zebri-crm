/**
 * Server actions for the Automations builder + list.
 *
 * Lifts mutations out of the client components so the page +
 * builder stay presentational. All actions are RLS-scoped via the
 * server Supabase client; the calling user is the source of truth.
 *
 * @module app/(dashboard)/automations/actions
 */
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { inMemoryLimiter } from '@/lib/api/rate-limit'
import {
  buildHomePayload,
  type AuditRow,
  type CoupleRow,
  type RunRow,
  type WaitRow,
} from '@/lib/automations/home-payload'
import { partitionResume } from '@/lib/automations/run-controls'
import { advanceRunNow } from '@/lib/automations/runner'
import { buildPublicBranding, type UserMetadata } from '@/lib/branding/public-branding'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type {
  AutomationRow,
  AutomationsHomePayload,
} from '@/types/automations'

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const createAutomationSchema = z.object({
  name: z.string().min(1).max(120),
  triggerType: z.string().min(1),
  triggerConfig: z.record(z.string(), z.any()).default({}),
  templateSlug: z.string().optional(),
})

export async function createAutomationAction(
  input: z.infer<typeof createAutomationSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createAutomationSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { ok: false, error: 'unauthorized' }
  const { data, error } = await supabase
    .from('automations' as never)
    .insert({
      user_id: auth.user.id,
      name: parsed.data.name,
      trigger_type: parsed.data.triggerType,
      trigger_config: parsed.data.triggerConfig,
      template_slug: parsed.data.templateSlug ?? null,
      status: 'draft',
    } as never)
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? 'failed' }
  revalidatePath('/automations')
  return { ok: true, data: { id: (data as { id: string }).id } }
}

const updateStatusSchema = z.object({
  automationId: z.string().uuid(),
  status: z.enum(['draft', 'active', 'paused', 'archived']),
})

export async function setAutomationStatusAction(
  input: z.infer<typeof updateStatusSchema>,
): Promise<ActionResult<null>> {
  const parsed = updateStatusSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { error } = await supabase
    .from('automations' as never)
    .update({ status: parsed.data.status } as never)
    .eq('id', parsed.data.automationId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/automations')
  return { ok: true, data: null }
}

const updateTriggerSchema = z.object({
  automationId: z.string().uuid(),
  triggerType: z.string().min(1),
  triggerConfig: z.record(z.string(), z.any()).default({}),
})

export async function setAutomationTriggerAction(
  input: z.infer<typeof updateTriggerSchema>,
): Promise<ActionResult<null>> {
  const parsed = updateTriggerSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { error } = await supabase
    .from('automations' as never)
    .update({ trigger_type: parsed.data.triggerType, trigger_config: parsed.data.triggerConfig } as never)
    .eq('id', parsed.data.automationId)
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/automations/${parsed.data.automationId}`)
  return { ok: true, data: null }
}

const updateNameSchema = z.object({
  automationId: z.string().uuid(),
  name: z.string().min(1).max(120),
})

export async function renameAutomationAction(
  input: z.infer<typeof updateNameSchema>,
): Promise<ActionResult<null>> {
  const parsed = updateNameSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { error } = await supabase
    .from('automations' as never)
    .update({ name: parsed.data.name } as never)
    .eq('id', parsed.data.automationId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/automations')
  return { ok: true, data: null }
}

const deleteAutomationSchema = z.object({ automationId: z.string().uuid() })

export async function deleteAutomationAction(
  input: z.infer<typeof deleteAutomationSchema>,
): Promise<ActionResult<null>> {
  const parsed = deleteAutomationSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { error } = await supabase
    .from('automations' as never)
    .delete()
    .eq('id', parsed.data.automationId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/automations')
  return { ok: true, data: null }
}

const upsertAutomationActionSchema = z.object({
  actionId: z.string().uuid().optional(),
  automationId: z.string().uuid(),
  position: z.number().int(),
  type: z.string().min(1),
  config: z.record(z.string(), z.any()).default({}),
  label: z.string().optional(),
  parentActionId: z.string().uuid().nullable().optional(),
  branchPath: z.enum(['yes', 'no']).nullable().optional(),
})

export async function upsertAutomationActionRow(
  input: z.infer<typeof upsertAutomationActionSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = upsertAutomationActionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  // True UPSERT - the client can supply a UUID it generated for
  // an optimistic insert. The id stays stable so any follow-up
  // mutations (drag-to-reposition, inline edits) hit the same
  // row whether the server has caught up or not.
  if (parsed.data.actionId) {
    const { data, error } = await supabase
      .from('automation_actions' as never)
      .upsert({
        id: parsed.data.actionId,
        automation_id: parsed.data.automationId,
        position: parsed.data.position,
        type: parsed.data.type,
        config: parsed.data.config,
        label: parsed.data.label ?? null,
        parent_action_id: parsed.data.parentActionId ?? null,
        branch_path: parsed.data.branchPath ?? null,
      } as never)
      .select('id')
      .single()
    if (error || !data) return { ok: false, error: error?.message ?? 'failed' }
    revalidatePath(`/automations/${parsed.data.automationId}`)
    return { ok: true, data: { id: (data as { id: string }).id } }
  }
  const { data, error } = await supabase
    .from('automation_actions' as never)
    .insert({
      automation_id: parsed.data.automationId,
      position: parsed.data.position,
      type: parsed.data.type,
      config: parsed.data.config,
      label: parsed.data.label ?? null,
      parent_action_id: parsed.data.parentActionId ?? null,
      branch_path: parsed.data.branchPath ?? null,
    } as never)
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? 'failed' }
  revalidatePath(`/automations/${parsed.data.automationId}`)
  return { ok: true, data: { id: (data as { id: string }).id } }
}

const updateAutomationActionPositionSchema = z.object({
  actionId: z.string().uuid(),
  positionX: z.number(),
  positionY: z.number(),
})

export async function updateAutomationActionPosition(
  input: z.infer<typeof updateAutomationActionPositionSchema>,
): Promise<ActionResult<null>> {
  const parsed = updateAutomationActionPositionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { error } = await supabase
    .from('automation_actions' as never)
    .update({ position_x: parsed.data.positionX, position_y: parsed.data.positionY } as never)
    .eq('id', parsed.data.actionId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: null }
}

const updateAutomationActionEdgesSchema = z.object({
  actionId: z.string().uuid(),
  parentActionId: z.string().uuid().nullable(),
  branchPath: z.enum(['yes', 'no']).nullable(),
})

export async function updateAutomationActionEdges(
  input: z.infer<typeof updateAutomationActionEdgesSchema>,
): Promise<ActionResult<null>> {
  const parsed = updateAutomationActionEdgesSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { error } = await supabase
    .from('automation_actions' as never)
    .update({ parent_action_id: parsed.data.parentActionId, branch_path: parsed.data.branchPath } as never)
    .eq('id', parsed.data.actionId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: null }
}

const deleteAutomationActionRowSchema = z.object({ actionId: z.string().uuid(), automationId: z.string().uuid() })

export async function deleteAutomationActionRow(
  input: z.infer<typeof deleteAutomationActionRowSchema>,
): Promise<ActionResult<null>> {
  const parsed = deleteAutomationActionRowSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { error } = await supabase.from('automation_actions' as never).delete().eq('id', parsed.data.actionId)
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/automations/${parsed.data.automationId}`)
  return { ok: true, data: null }
}

const pauseCoupleSchema = z.object({ coupleId: z.string().uuid() })

export async function pauseCoupleRunsAction(
  input: z.infer<typeof pauseCoupleSchema>,
): Promise<ActionResult<{ paused: number }>> {
  const parsed = pauseCoupleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { error, count } = await supabase
    .from('automation_runs' as never)
    .update({ status: 'paused' } as never, { count: 'exact' })
    .eq('couple_id', parsed.data.coupleId)
    .in('status', ['running', 'waiting'])
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: { paused: count ?? 0 } }
}

/* ─── per-run / per-automation controls (couple Automations tab) ─── */

const runIdSchema = z.object({ runId: z.string().uuid() })

/**
 * Re-open an errored run from the step that failed.
 *
 * The runner records the failing action in `current_action_id` and
 * leaves it there on failure, so flipping the run back to `running`
 * (and clearing the error) makes the next tick re-attempt that step.
 * Guarded to `errored` rows only — a no-op on anything else.
 *
 * Not rate-limited: authenticated, RLS-scoped, single-user, same as
 * the other builder actions. Any billable re-send is guarded inside
 * the action handler itself (e.g. the `send_email` recipient check).
 */
export async function retryRunAction(
  input: z.infer<typeof runIdSchema>,
): Promise<ActionResult<null>> {
  const parsed = runIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const runId = parsed.data.runId

  // Standard retry: an errored run resumes from its current action.
  const { error } = await supabase
    .from('automation_runs' as never)
    .update({ status: 'running', error_message: null, completed_at: null } as never)
    .eq('id', runId)
    .eq('status', 'errored')
  if (error) return { ok: false, error: error.message }

  // "Fix & retry" on a missing-variable block: a paused run holds an
  // open `missing_variables` wait. Consume it and resume so the runner
  // re-checks the now-fixed couple data on the next tick.
  const { data: wait } = await supabase
    .from('automation_waits' as never)
    .select('id')
    .eq('run_id', runId)
    .eq('reason', 'missing_variables')
    .is('consumed_at', null)
    .maybeSingle()
  if (wait) {
    const id = (wait as { id: string }).id
    await supabase
      .from('automation_waits' as never)
      .update({ consumed_at: new Date().toISOString() } as never)
      .eq('id', id)
    await supabase
      .from('automation_runs' as never)
      .update({ status: 'running' } as never)
      .eq('id', runId)
      .eq('status', 'paused')
  }
  return { ok: true, data: null }
}

/**
 * Cancel a run that hasn't finished (waiting or paused).
 *
 * Sets the run to `cancelled` and consumes any pending wait so the
 * wake loop can't resurrect it. (The wake loop only flips rows that
 * are still `waiting`, so the status change alone is sufficient;
 * consuming the wait keeps the trail clean.)
 */
export async function cancelRunAction(
  input: z.infer<typeof runIdSchema>,
): Promise<ActionResult<null>> {
  const parsed = runIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { error } = await supabase
    .from('automation_runs' as never)
    .update({ status: 'cancelled', completed_at: new Date().toISOString() } as never)
    .eq('id', parsed.data.runId)
    .in('status', ['waiting', 'paused'])
  if (error) return { ok: false, error: error.message }
  await supabase
    .from('automation_waits' as never)
    .update({ consumed_at: new Date().toISOString() } as never)
    .eq('run_id', parsed.data.runId)
    .is('consumed_at', null)
  return { ok: true, data: null }
}

const automationCoupleSchema = z.object({
  automationId: z.string().uuid(),
  coupleId: z.string().uuid(),
})

/** Pause one automation's live runs for a couple (scoped "Pause all"). */
export async function pauseAutomationForCoupleAction(
  input: z.infer<typeof automationCoupleSchema>,
): Promise<ActionResult<{ paused: number }>> {
  const parsed = automationCoupleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { error, count } = await supabase
    .from('automation_runs' as never)
    .update({ status: 'paused' } as never, { count: 'exact' })
    .eq('automation_id', parsed.data.automationId)
    .eq('couple_id', parsed.data.coupleId)
    .in('status', ['running', 'waiting'])
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: { paused: count ?? 0 } }
}

/**
 * Resume an automation's paused runs for a couple.
 *
 * Pausing collapses both `running` and `waiting` into `paused`, so
 * resume must reconstruct the right state per run: a run that still
 * has an **unconsumed wait** goes back to `waiting` (the wait/wake
 * machinery keeps owning it); any other paused run goes to `running`
 * so the next tick advances it. Resuming everything to `running`
 * would skip pending waits and double-fire scheduled steps.
 */
export async function resumeAutomationForCoupleAction(
  input: z.infer<typeof automationCoupleSchema>,
): Promise<ActionResult<{ resumed: number }>> {
  const parsed = automationCoupleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()

  const { data: pausedRows, error: readErr } = await supabase
    .from('automation_runs' as never)
    .select('id')
    .eq('automation_id', parsed.data.automationId)
    .eq('couple_id', parsed.data.coupleId)
    .eq('status', 'paused')
  if (readErr) return { ok: false, error: readErr.message }
  const pausedIds = ((pausedRows as { id: string }[] | null) ?? []).map((r) => r.id)
  if (pausedIds.length === 0) return { ok: true, data: { resumed: 0 } }

  const { data: waitRows } = await supabase
    .from('automation_waits' as never)
    .select('run_id')
    .in('run_id', pausedIds)
    .is('consumed_at', null)
  const { toRunning, toWaiting } = partitionResume(
    pausedIds,
    ((waitRows as { run_id: string }[] | null) ?? []).map((w) => w.run_id),
  )

  if (toRunning.length > 0) {
    await supabase
      .from('automation_runs' as never)
      .update({ status: 'running' } as never)
      .in('id', toRunning)
      .eq('status', 'paused')
  }
  if (toWaiting.length > 0) {
    await supabase
      .from('automation_runs' as never)
      .update({ status: 'waiting' } as never)
      .in('id', toWaiting)
      .eq('status', 'paused')
  }
  return { ok: true, data: { resumed: pausedIds.length } }
}

/* ─── run an automation now (couple Automations tab) ─────────────── */

/** A runnable automation for the "Run automation" picker. */
export interface RunnableAutomation {
  id: string
  name: string
  trigger_type: string
}

/**
 * List the caller's **active** automations for the run picker.
 *
 * RLS-scoped, so it only ever returns the caller's rows. Drafts and
 * paused/archived automations are excluded — you can only manually
 * fire something that's live.
 */
export async function loadRunnableAutomationsAction(): Promise<ActionResult<RunnableAutomation[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('automations' as never)
    .select('id, name, trigger_type')
    .eq('status', 'active')
    .order('name', { ascending: true })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: (data as RunnableAutomation[] | null) ?? [] }
}

// Per-user cap on manual runs — each can fan out a real send, so this
// stops a click-loop from hammering Resend. Keyed by user id (not IP)
// because server actions have no Request to read an address from.
const manualRunLimiter = inMemoryLimiter({ windowMs: 60_000, max: 20 })

const runForCoupleSchema = z.object({
  automationId: z.string().uuid(),
  coupleId: z.string().uuid(),
})

/**
 * Open + execute one manual run of an automation against a couple.
 *
 * Ownership is verified with the **user** client (RLS), then the run
 * is opened and executed with the **service-role** client: a synthetic
 * `manual_fire` event is written pre-`processed_at` (so the dispatcher
 * ignores it — no double run), a run is opened at the automation's
 * first action, and {@link advanceRunNow} drives it to completion /
 * sleep inline so the MC sees the result immediately instead of
 * waiting for the next cron tick. Bypasses the trigger predicate by
 * design — the MC is the trigger.
 *
 * When `testMode` is set, the synthetic event carries `test_mode: true`,
 * which `send_email` reads to route any outgoing email to the MC's own
 * address (tagged `[Test]`) instead of the couple — so the MC can
 * preview the email without contacting the couple. Non-email actions
 * still run for real.
 */
async function openManualRun(
  input: z.infer<typeof runForCoupleSchema>,
  testMode: boolean,
): Promise<ActionResult<{ runId: string }>> {
  const parsed = runForCoupleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const { automationId, coupleId } = parsed.data

  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { ok: false, error: 'unauthorized' }

  const rl = await manualRunLimiter.check(auth.user.id)
  if (!rl.allowed) return { ok: false, error: 'Too many manual runs — wait a moment and try again.' }

  // RLS reads — only the caller's rows resolve, so this is the
  // ownership check for both the automation and the couple.
  const { data: automation } = await supabase
    .from('automations' as never)
    .select('id, status')
    .eq('id', automationId)
    .maybeSingle()
  const auto = automation as { id: string; status: string } | null
  if (!auto) return { ok: false, error: 'Automation not found.' }
  if (auto.status !== 'active') return { ok: false, error: 'Activate the automation before running it.' }

  const { data: couple } = await supabase
    .from('couples' as never)
    .select('id')
    .eq('id', coupleId)
    .maybeSingle()
  if (!couple) return { ok: false, error: 'Couple not found.' }

  const admin = createAdminClient()

  const { data: firstAction } = await admin
    .from('automation_actions' as never)
    .select('id')
    .eq('automation_id', automationId)
    .is('parent_action_id', null)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!firstAction) return { ok: false, error: 'This automation has no steps to run.' }

  const flags = testMode ? { manual: true, test_mode: true } : { manual: true }

  // Synthetic trigger event, pre-marked processed so the dispatcher
  // never opens a second run for it (no active automation keys on
  // `manual_fire` anyway, but this makes it explicit and race-free).
  const { data: event, error: evErr } = await admin
    .from('automation_events' as never)
    .insert({
      user_id: auth.user.id,
      source_table: 'manual_fire',
      source_id: coupleId,
      event_type: 'manual_fire',
      payload: { ...flags, automation_id: automationId },
      couple_id: coupleId,
      processed_at: new Date().toISOString(),
    } as never)
    .select('id')
    .single()
  if (evErr) return { ok: false, error: evErr.message }

  const { data: run, error: runErr } = await admin
    .from('automation_runs' as never)
    .insert({
      automation_id: automationId,
      event_id: (event as { id: string }).id,
      user_id: auth.user.id,
      couple_id: coupleId,
      status: 'running',
      current_action_id: (firstAction as { id: string }).id,
      last_payload: { trigger_payload: flags, action_results: {} },
    } as never)
    .select('id')
    .single()
  if (runErr) return { ok: false, error: runErr.message }

  const runId = (run as { id: string }).id
  await advanceRunNow(admin, runId)
  return { ok: true, data: { runId } }
}

/** Run an automation against a couple for real, right now. */
export async function runAutomationForCoupleAction(
  input: z.infer<typeof runForCoupleSchema>,
): Promise<ActionResult<{ runId: string }>> {
  return openManualRun(input, false)
}

/**
 * Test-run an automation against a couple: actions execute, but any
 * email is sent to the MC (tagged `[Test]`) instead of the couple.
 */
export async function testAutomationForCoupleAction(
  input: z.infer<typeof runForCoupleSchema>,
): Promise<ActionResult<{ runId: string }>> {
  return openManualRun(input, true)
}

/* ─── /automations home loader ──────────────────────────────────── */

/**
 * Single batched read powering the /automations home page.
 *
 * Fires five reads in parallel - RLS-scoped because the supabase
 * client is the user's. Aggregation happens in
 * `lib/automations/home-payload.ts`, which is pure and unit-tested
 * separately.
 */
export async function loadAutomationsHomeAction(): Promise<
  ActionResult<AutomationsHomePayload>
> {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { ok: false, error: 'unauthorized' }

  const [autoRes, runsRes, waitsRes, recentRes, couplesRes] = await Promise.all([
    supabase
      .from('automations' as never)
      .select('*')
      .order('updated_at', { ascending: false }),
    supabase
      .from('automation_runs' as never)
      .select('id, automation_id, couple_id, status, started_at, completed_at'),
    supabase
      .from('automation_waits' as never)
      .select('id, run_id, wake_at, consumed_at')
      .is('consumed_at', null),
    supabase
      .from('automation_audit_log' as never)
      .select('id, automation_id, run_id, event, details, created_at')
      .eq('event', 'action_completed')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('couples').select('id, name'),
  ])

  if (autoRes.error) return { ok: false, error: autoRes.error.message }

  const payload = buildHomePayload({
    automations: (autoRes.data as AutomationRow[] | null) ?? [],
    runs: (runsRes.data as RunRow[] | null) ?? [],
    waits: (waitsRes.data as WaitRow[] | null) ?? [],
    recent: (recentRes.data as AuditRow[] | null) ?? [],
    couples: (couplesRes.data as CoupleRow[] | null) ?? [],
  })

  return { ok: true, data: payload }
}

/**
 * The MC's own name and branding, for previewing a canned email in
 * the builder.
 *
 * The automation isn't attached to a couple, so a preview uses sample
 * couple details — but the *sender* half should be real, or the MC is
 * looking at someone else's email. Reads the calling user's own
 * metadata (no admin client, no user id parameter).
 */
export async function loadSenderIdentityAction(): Promise<{
  businessName: string
  branding: PublicBranding | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const metadata = (user?.user_metadata ?? {}) as UserMetadata
  return {
    businessName: (metadata.business_name as string | undefined)?.trim() || 'Your business',
    branding: buildPublicBranding(metadata),
  }
}

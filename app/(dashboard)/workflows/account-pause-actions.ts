'use server'

/**
 * Server actions for the account-wide stop on workflow automation.
 *
 * The MC's emergency brake: one switch that stops every automated
 * workflow step on their account (see `lib/workflows/account-pause`).
 * Read and written through the caller's RLS client, so the own-row
 * policies on `user_public_settings` are the ownership check and no
 * input names a user.
 *
 * Deliberately separate from pausing one couple's workflow (Task 16)
 * and from turning one workflow off (Task 17): nothing here writes an
 * instance's status, so lifting the stop never restarts a couple that
 * was paused on its own.
 *
 * @module app/(dashboard)/workflows/account-pause-actions
 */

import { revalidatePath } from 'next/cache'

import { sendAlert } from '@/lib/alerts/send-alert'
import { createClient } from '@/lib/supabase/server'
import { isAccountPaused } from '@/lib/workflows/account-pause'
import { AUTOMATED_STEP_TYPES } from '@/lib/workflows/steps'

import type { ActionResult } from './instance-actions'

/** What the UI needs to know about the stop. */
export interface AccountPauseView {
  /** True while the stop is on. */
  paused: boolean
  /** When the stop went on, while it is on; otherwise null. */
  pausedAt: string | null
}

type Client = Awaited<ReturnType<typeof createClient>>

/** The caller's stop columns, or null when they have no settings row. */
async function readOwnStop(supabase: Client, userId: string) {
  return supabase
    .from('user_public_settings')
    .select('workflows_paused_at, workflows_resumed_at')
    .eq('user_id', userId)
    .maybeSingle()
}

/** Is the signed-in MC's workflow automation stopped? */
export async function getAccountPauseAction(): Promise<ActionResult<AccountPauseView>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }
  const { data, error } = await readOwnStop(supabase, user.id)
  if (error) return { ok: false, error: error.message }
  const state = { pausedAt: data?.workflows_paused_at ?? null, resumedAt: data?.workflows_resumed_at ?? null }
  const paused = isAccountPaused(state)
  return { ok: true, data: { paused, pausedAt: paused ? state.pausedAt : null } }
}

/**
 * Does a lifted window still hold steps the executor has not skipped yet?
 *
 * The executor skips a lifted window's steps lazily, a tick at a time. A
 * stop pressed again before it has finished would otherwise overwrite
 * the window, and whatever was left in it would fire as soon as the new
 * stop lifted.
 *
 * Returns an error when the read fails rather than "no backlog": that
 * answer starts a fresh window and strands the old one's backlog, which
 * then fires when the new stop lifts.
 */
async function windowHasBacklog(
  supabase: Client,
  userId: string,
  pausedAt: string,
  resumedAt: string,
): Promise<{ backlog: boolean } | { error: string }> {
  const { data, error } = await supabase
    .from('workflow_steps')
    .select('id, workflow_instances!inner(user_id, status)')
    .eq('workflow_instances.user_id', userId)
    .eq('workflow_instances.status', 'active')
    .in('status', ['pending', 'waiting'])
    .in('type', AUTOMATED_STEP_TYPES)
    // A step held for the MC's OK never runs by itself, so it is not
    // backlog. Counting it would let one unanswered approval make every
    // later re-stop inherit the original start, widening the window for
    // good.
    .eq('requires_approval', false)
    .gte('due_at', pausedAt)
    .lte('due_at', resumedAt)
    // Same test the executor applies (isLiftedPauseBacklog): a step
    // dated after the lift is not backlog, whatever its due time.
    .lte('updated_at', resumedAt)
    .limit(1)
  if (error) return { error: error.message }
  return { backlog: (data?.length ?? 0) > 0 }
}

/**
 * Stop every automated workflow step on the caller's account.
 *
 * Upserts: an MC who has never saved another setting has no row, and a
 * missing row reads as running.
 */
export async function pauseAccountWorkflowsAction(): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { data: row, error: readErr } = await readOwnStop(supabase, user.id)
  if (readErr) return { ok: false, error: readErr.message }
  const previous = { pausedAt: row?.workflows_paused_at ?? null, resumedAt: row?.workflows_resumed_at ?? null }
  if (isAccountPaused(previous)) return { ok: false, error: 'Workflows are already paused.' }

  // A stop pressed again while the last window is still being skipped
  // keeps that window's start, so the new window covers the old
  // backlog too. The cost is that anything which came due between the
  // two stops and has not run yet is skipped as well, which is the side
  // this errs on: late, never sent in a burst.
  let pausedAt = new Date().toISOString()
  if (previous.pausedAt && previous.resumedAt) {
    const check = await windowHasBacklog(supabase, user.id, previous.pausedAt, previous.resumedAt)
    // A check that could not run keeps the old start too. Refusing would
    // leave the MC unable to stop sending in an emergency; a fresh start
    // would strand the old backlog. Keeping it costs, at worst, skipping
    // what came due between the two stops.
    if ('error' in check) {
      console.error('[workflows] could not check the last stop window, keeping its start', check.error)
      pausedAt = previous.pausedAt
    } else if (check.backlog) {
      pausedAt = previous.pausedAt
    }
  }

  const { error } = await supabase
    .from('user_public_settings')
    .upsert(
      { user_id: user.id, workflows_paused_at: pausedAt, workflows_resumed_at: null },
      { onConflict: 'user_id' },
    )
  if (error) return { ok: false, error: error.message }

  void sendAlert({ type: 'workflows_account_paused', severity: 'warn', userId: user.id, action: 'paused' })
  revalidatePath('/workflows')
  return { ok: true, data: null }
}

/**
 * Lift the stop.
 *
 * Only stamps the end of the window. The executor skips whatever came
 * due inside it as it reaches each step, rather than here: a sweep of
 * every instance at lift time could time out on a large account, and a
 * half-finished sweep would leave the rest to fire late.
 */
export async function resumeAccountWorkflowsAction(): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  // Guarded on the row still being stopped, so a double click cannot
  // move the end of a window that has already closed.
  const { data, error } = await supabase
    .from('user_public_settings')
    .update({ workflows_resumed_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .not('workflows_paused_at', 'is', null)
    .is('workflows_resumed_at', null)
    .select('user_id')
  if (error) return { ok: false, error: error.message }
  if ((data?.length ?? 0) === 0) return { ok: false, error: 'Workflows are not paused.' }

  void sendAlert({ type: 'workflows_account_paused', severity: 'warn', userId: user.id, action: 'resumed' })
  revalidatePath('/workflows')
  return { ok: true, data: null }
}

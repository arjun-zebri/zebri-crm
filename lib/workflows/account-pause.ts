/**
 * The account-wide stop for workflow automation.
 *
 * One switch per MC, stored on `user_public_settings` as two timestamps
 * (migration 20261009000000). While it is on, the executor runs none of
 * the MC's automated steps and the send gate refuses their automated
 * sends. It never touches an instance's own status: a couple paused on
 * purpose (Task 16) or by turning a workflow off (Task 17) stays paused
 * after the stop lifts, and resuming one couple does not lift it.
 *
 * Once lifted, the two timestamps are the window the stop covered, and
 * an automated step whose due time fell inside it is skipped with an
 * audit line instead of firing late. That is the rule every stop in the
 * product follows: it must never end in a burst of the backlog.
 *
 * Pure helpers plus two reads. No writes: the only writer is the MC,
 * through `app/(dashboard)/workflows/account-pause-actions.ts`.
 *
 * @module lib/workflows/account-pause
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

/** One MC's stop, as stored. Both null means it has never been used. */
export interface AccountPauseState {
  /** When the stop went on, or null. */
  pausedAt: string | null;
  /** When it was lifted, or null while it is on. */
  resumedAt: string | null;
}

/** The row shape both reads select. */
interface PauseRow {
  user_id: string;
  workflows_paused_at: string | null;
  workflows_resumed_at: string | null;
}

const PAUSE_COLUMNS = 'user_id, workflows_paused_at, workflows_resumed_at';

function toState(row: PauseRow): AccountPauseState {
  return { pausedAt: row.workflows_paused_at, resumedAt: row.workflows_resumed_at };
}

/**
 * Is the stop on right now?
 *
 * A missing row, or a row that has never been paused, is running.
 */
export function isAccountPaused(state: AccountPauseState | null | undefined): boolean {
  return Boolean(state?.pausedAt) && !state?.resumedAt;
}

/**
 * Did this due time fall inside a stop that has since been lifted?
 *
 * Inclusive at both ends. A step deferred by the send gate at the very
 * moment the stop went on is stamped due at that moment, and it must
 * count as having come due while stopped.
 *
 * @param state - the MC's stop
 * @param dueAt - the step's `due_at`
 */
export function inLiftedPauseWindow(
  state: AccountPauseState | null | undefined,
  dueAt: string | null,
): boolean {
  if (!state?.pausedAt || !state.resumedAt || !dueAt) return false;
  const due = new Date(dueAt).getTime();
  return (
    due >= new Date(state.pausedAt).getTime() && due <= new Date(state.resumedAt).getTime()
  );
}

/**
 * Is this step backlog from a lifted stop: due inside the window, and
 * last written before the stop lifted?
 *
 * The second half is what separates "came due while stopped" from "was
 * given a date inside the window after the stop had already lifted" (a
 * wedding date added later, say, stamping a wedding-relative step in
 * the past). The first is backlog and is skipped; the second is an
 * ordinary overdue step the MC just scheduled, and runs. It holds
 * because `workflow_steps_set_updated_at` stamps every UPDATE and the
 * recomputes only write rows whose `due_at` changed.
 *
 * @param state - the MC's stop
 * @param step - the step's `due_at` and `updated_at`
 */
export function isLiftedPauseBacklog(
  state: AccountPauseState | null | undefined,
  step: { due_at: string | null; updated_at: string },
): boolean {
  if (!inLiftedPauseWindow(state, step.due_at)) return false;
  return new Date(step.updated_at).getTime() <= new Date(state!.resumedAt!).getTime();
}

/** Rows per page in {@link loadAccountPauses}; at most the API's `max_rows`. */
const PAUSE_PAGE_SIZE = 1000;

/**
 * Every MC who has ever used the stop.
 *
 * The executor calls this once per pass, before it reads a single due
 * step, so one tick costs one read (one per thousand stopped-at-some-
 * point MCs) however many tenants it serves. The executor uses it for
 * the lifted windows; the due read itself (`./due-steps`) excludes an
 * active stop in SQL. Throws when the read fails: the caller must not
 * run anybody's steps on a stop it could not check.
 *
 * @param supabase - service-role client
 * @param userId - restrict to one MC (the scoped kick)
 * @returns stops keyed by user id; an MC with no entry is running
 */
export async function loadAccountPauses(
  supabase: SupabaseClient<Database>,
  userId?: string,
): Promise<Map<string, AccountPauseState>> {
  const pauses = new Map<string, AccountPauseState>();
  // Paged, because the API caps one response at `max_rows` (1000) and
  // truncates without an error. Every MC who has ever used the stop
  // stays in this set, and a lifted window missing from it would let
  // that MC's held-back steps fire late in a burst. Ordered by the key
  // so the pages neither overlap nor skip.
  for (let from = 0; ; from += PAUSE_PAGE_SIZE) {
    let query = supabase
      .from('user_public_settings')
      .select(PAUSE_COLUMNS)
      .not('workflows_paused_at', 'is', null);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query
      .order('user_id', { ascending: true })
      .range(from, from + PAUSE_PAGE_SIZE - 1);
    if (error) throw new Error(`could not read the account-wide workflow stop: ${error.message}`);
    for (const row of data ?? []) pauses.set(row.user_id, toState(row));
    if ((data ?? []).length < PAUSE_PAGE_SIZE) return pauses;
  }
}

/** {@link readAccountPause}'s answer. */
export type AccountPauseCheck =
  | { status: 'paused' }
  | { status: 'running' }
  | { status: 'unknown'; reason: string };

/**
 * One MC's stop, for the send gate.
 *
 * Three outcomes, not two, like the opt-out checks beside it: a read
 * that failed is not "running".
 *
 * @param supabase - service-role client
 * @param userId - the workflow owner
 */
export async function readAccountPause(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<AccountPauseCheck> {
  // A thrown read (a dropped connection) is caught too: the gate runs
  // inside a send, and an exception there would surface as a failed send
  // rather than the retryable "could not check" it is.
  try {
    const { data, error } = await supabase
      .from('user_public_settings')
      .select(PAUSE_COLUMNS)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return { status: 'unknown', reason: error.message };
    return isAccountPaused(data ? toState(data) : null)
      ? { status: 'paused' }
      : { status: 'running' };
  } catch (err) {
    return { status: 'unknown', reason: err instanceof Error ? err.message : String(err) };
  }
}

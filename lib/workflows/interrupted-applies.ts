/**
 * Cleaning up an apply that did not finish.
 *
 * `applyTemplate` builds a new instance while it is `paused` with a null
 * `paused_reason` and flips it live only at the end (`./instantiate`).
 * Nothing else ever writes that state: a pause the MC makes is `manual`,
 * one the Turn off switch makes is `template_off`. So "paused, no
 * reason" means exactly "an apply is building this, or was and stopped".
 *
 * Left alone, a stopped one does harm in two ways. It still holds the
 * couple's `dedupe_key` (the unique index skips only `cancelled` rows),
 * so every later event for the same workflow is refused as "already
 * applied" and marked dispatched anyway. And it is half built: its steps
 * may be missing, undated, or not yet settled, so it must never go live.
 * Cancelling it releases the key and keeps it off the executor for good.
 *
 * Two paths reach the same end:
 * - {@link abandonApply}: the apply saw its own failure and cancels on
 *   the spot.
 * - {@link sweepInterruptedApplies}: the function died or timed out, so
 *   the tick cancels the row once it is too old to still be building.
 *
 * @module lib/workflows/interrupted-applies
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

import { writeAudit, writeAuditMany } from './audit';

/**
 * How old a still-building instance must be before the sweep calls it
 * dead. An apply takes a handful of round trips, and the function limit
 * is 60 seconds, so ten minutes can only be a run that is gone.
 */
export const INTERRUPTED_APPLY_MS = 10 * 60_000;

/**
 * The audit reason and the instance's `cancelled_reason`, shared by both
 * paths so the feed and Resume read the same.
 */
const REASON = 'setup_interrupted';

/**
 * Cancel an instance whose apply just failed.
 *
 * Guarded on the building state, so it never touches an instance that
 * did go live (an RPC that errored after committing), or one the MC or
 * the switch has paused since.
 *
 * @param supabase - service-role client
 * @param instance - the half-built instance
 */
export async function abandonApply(
  supabase: SupabaseClient<Database>,
  instance: { id: string; user_id: string; couple_id: string | null },
): Promise<void> {
  // The error is not checked, deliberately: the apply has already failed
  // and said so to its caller. If this cancel does not land, the row is
  // still paused with a null reason, which is exactly what
  // sweepInterruptedApplies cancels on the tick after
  // INTERRUPTED_APPLY_MS, and that sweep throws on a failed statement.
  const { data } = await supabase
    .from('workflow_instances')
    // The reason is what makes Resume refuse it; the trigger in
    // 20261011000000 cancels its open steps in the same statement.
    .update({ status: 'cancelled', cancelled_reason: REASON, completed_at: new Date().toISOString() })
    .eq('id', instance.id)
    .eq('status', 'paused')
    .is('paused_reason', null)
    .select('id');
  if ((data?.length ?? 0) !== 1) return;
  await writeAudit(supabase, {
    userId: instance.user_id,
    instanceId: instance.id,
    coupleId: instance.couple_id,
    event: 'instance_cancelled',
    detail: { reason: REASON },
  });
}

/**
 * Cancel every instance an apply started and never finished.
 *
 * One statement for the whole platform, run by the tick next to the
 * stuck-step sweep. Only rows still `paused` with a null reason and
 * applied more than {@link INTERRUPTED_APPLY_MS} ago qualify; a `manual`
 * or `template_off` pause is never touched.
 *
 * @param supabase - service-role client
 * @param olderThanMs - override the staleness window, for tests
 * @returns how many instances were cancelled
 */
export async function sweepInterruptedApplies(
  supabase: SupabaseClient<Database>,
  olderThanMs: number = INTERRUPTED_APPLY_MS,
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const { data, error } = await supabase
    .from('workflow_instances')
    // The reason is what makes Resume refuse it; the trigger in
    // 20261011000000 cancels its open steps in the same statement.
    .update({ status: 'cancelled', cancelled_reason: REASON, completed_at: new Date().toISOString() })
    .eq('status', 'paused')
    .is('paused_reason', null)
    .lt('applied_at', cutoff)
    .select('id, user_id, couple_id');
  if (error) throw new Error(`sweep interrupted applies: ${error.message}`);

  const rows = data ?? [];
  await writeAuditMany(
    supabase,
    rows.map((row) => ({
      userId: row.user_id,
      instanceId: row.id,
      coupleId: row.couple_id,
      event: 'instance_cancelled' as const,
      detail: { reason: REASON },
    })),
  );
  return rows.length;
}

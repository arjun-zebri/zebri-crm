/**
 * `step_overdue` time-based emitter.
 *
 * Replaces the retired `task_overdue` emitter. Fires when a manual
 * workflow step (`todo` or `appointment`) has sat past its `due_at`
 * without being ticked. Automated steps are excluded: those are the
 * engine's problem, and one sitting past its due date means the executor
 * is behind, not that the MC is.
 *
 * # Emit semantics
 *
 * One event per (step, calendar day). A step fires once a day while it
 * stays overdue, not once per tick, and the payload carries
 * `days_overdue` so a workflow's `on_event` rule can narrow to its own
 * threshold. Idempotency is the same day-bucket dedupe against
 * `automation_events` the other emitters use.
 *
 * @module lib/workflows/emitters/step-overdue
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { TimeEmitter } from '@/lib/automations/time-emitters';
import type { Database } from '@/types/database';

/** Lower bound for "today" in UTC, for the per-day dedupe window. */
function startOfUtcDay(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

/** Whole days between `dueAt` and now, floored at 0. */
function daysOverdue(dueAt: string): number {
  const diff = Date.now() - new Date(dueAt).getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

async function run(supabase: SupabaseClient<Database>): Promise<number> {
  const nowIso = new Date().toISOString();

  const { data: rows } = await supabase
    .from('workflow_steps')
    .select(
      'id, instance_id, type, title, due_at, status, workflow_instances!inner(id, user_id, couple_id, status)',
    )
    .eq('status', 'pending')
    .in('type', ['todo', 'appointment'])
    .not('due_at', 'is', null)
    .lt('due_at', nowIso)
    .limit(500);

  if (!rows || rows.length === 0) return 0;

  // One dedupe query for the whole batch rather than one per step.
  const { data: alreadyEmitted } = await supabase
    .from('automation_events')
    .select('source_id')
    .eq('event_type', 'step_overdue')
    .gte('created_at', startOfUtcDay());
  const seen = new Set((alreadyEmitted ?? []).map((e) => e.source_id));

  let emitted = 0;

  for (const row of rows) {
    const instance = row.workflow_instances as unknown as {
      user_id: string;
      couple_id: string | null;
      status: string;
    } | null;
    // A cancelled or completed instance keeps its steps but must not
    // nag: the MC has already decided that work is not happening.
    if (!instance || instance.status !== 'active') continue;
    if (seen.has(row.id)) continue;
    if (!row.due_at) continue;

    const { error } = await supabase.rpc('emit_automation_event', {
      p_user_id: instance.user_id,
      p_source_table: 'workflow_steps',
      p_source_id: row.id,
      p_event_type: 'step_overdue',
      p_payload: {
        step_id: row.id,
        instance_id: row.instance_id,
        couple_id: instance.couple_id,
        step_type: row.type,
        title: row.title,
        due_at: row.due_at,
        days_overdue: daysOverdue(row.due_at),
      },
      ...(instance.couple_id ? { p_couple_id: instance.couple_id } : {}),
    });
    if (!error) emitted += 1;
  }

  return emitted;
}

export const stepOverdueEmitter: TimeEmitter = {
  type: 'step_overdue',
  run,
};

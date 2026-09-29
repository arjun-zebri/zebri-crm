/**
 * End a workflow from inside it: skip everything it has not done yet.
 *
 * The "Start workflow" step's "End this workflow" option
 * (`lib/automations/actions/workflow`) is a hand-off: the couple moves on
 * to the next workflow, and what is left of this one would only nag the
 * MC or email the couple about a stage they have left. So every step
 * still pending or waiting is marked skipped, and the executor's normal
 * completion check then completes the instance. It completes rather than
 * being cancelled on purpose: the workflow did what the MC built it to
 * do, and a completion is what "When a workflow is completed" listens for.
 *
 * Not touched:
 *
 * - a `running` step, which another caller is executing right now and
 *   will finish (the same rule as Turn off);
 * - an `errored` step, which stays for the MC to see and deal with. It
 *   also keeps the workflow from completing, the same as anywhere else: a
 *   broken send is never tidied away by a later step.
 *
 * Skipped with no `skip_reason`, so reopening a branch never brings these
 * back; reopening the Start workflow step itself does not either. The MC
 * ended the workflow, and a reopen is for redoing one step.
 *
 * Idempotent: only rows still pending or waiting are written, so the heal
 * redoing an end that already landed writes nothing and no audit rows.
 *
 * @module lib/workflows/end-instance
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/types/database';
import type { WorkflowInstanceRow } from '@/types/workflows';

import { writeAuditMany } from './audit';
import { throwIfReadFailed } from './read-failure';

/** The timeline's reason on each step an end skipped. */
export const ENDED_REASON = 'the couple moved on to the next workflow';

/**
 * Did this finished step end its workflow? True for a Start workflow step
 * whose output says so.
 *
 * @param output - the step's `output` jsonb
 */
export function endsWorkflow(output: unknown): boolean {
  if (typeof output !== 'object' || output === null || Array.isArray(output)) return false;
  return (output as Record<string, unknown>)['ended_workflow'] === true;
}

/**
 * Skip every step of the instance still pending or waiting, writing one
 * `step_skipped` audit row per step skipped.
 *
 * @param supabase - service-role client
 * @param instance - the instance to end
 * @param byStepId - the step that ended it, recorded on each audit row
 * @param opts.site - the read-failure site for this caller
 * @param opts.via - who redid it, when it is not the first attempt
 * @returns how many steps were skipped
 * @throws WorkflowReadError when the write fails: the steps left pending
 *   would carry on running after the couple moved on
 */
export async function endRestOfInstance(
  supabase: SupabaseClient<Database>,
  instance: WorkflowInstanceRow,
  byStepId: string,
  opts: { site: string; via?: string },
): Promise<number> {
  const { data, error } = await supabase
    .from('workflow_steps')
    .update({ status: 'skipped', completed_at: new Date().toISOString() })
    .eq('instance_id', instance.id)
    .in('status', ['pending', 'waiting'])
    .select('id');
  throwIfReadFailed(opts.site, error);
  const skipped = (data ?? []).map((row) => row.id);
  if (skipped.length === 0) return 0;

  const detail: Record<string, Json> = { reason: ENDED_REASON, ended_by: byStepId };
  if (opts.via) detail['via'] = opts.via;
  await writeAuditMany(
    supabase,
    skipped.map((stepId) => ({
      userId: instance.user_id,
      instanceId: instance.id,
      stepId,
      coupleId: instance.couple_id,
      event: 'step_skipped' as const,
      detail,
    })),
  );
  return skipped.length;
}

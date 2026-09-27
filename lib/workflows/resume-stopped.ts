/**
 * The extra work a stopped (cancelled) workflow needs before it resumes.
 *
 * Stopping marks the instance's unstarted steps `cancelled` (a trigger in
 * 20261011000000). So before the resume rule in `./resume` can judge
 * them, they have to be ordinary open steps again. The order in
 * `resumeInstanceAction` is:
 *
 * 1. {@link findLiveTwin}: refuse up front if the same workflow was
 *    started again on this couple, before anything is written.
 * 2. {@link restoreCancelledSteps}: back to `pending`, and re-dated.
 * 3. `settleOverdueForResume`: skip whatever went overdue.
 * 4. Flip the instance to `active` through `resume_workflow_instance`,
 *    guarded on it still being cancelled and its workflow still on.
 * 5. {@link undoRestore} if that flip did not land, so a workflow that
 *    stays stopped reads stopped.
 *
 * The instance stays `cancelled` through 2 and 3, and the executor runs
 * only `active` instances, so no tick can send a restored step before the
 * settle has judged it.
 *
 * @module lib/workflows/resume-stopped
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';
import type { WorkflowInstanceRow } from '@/types/workflows';

import { recomputeInstance } from './executor';
import { hasLiveTwin } from './resume-eligibility';

/**
 * Is the same workflow already running (or paused) on this couple?
 *
 * The dedupe index admits one live enrolment per couple and template
 * (`status <> 'cancelled'`), so resuming the stopped one would fail on
 * the flip. Checked first so the refusal writes nothing. The flip still
 * maps a unique violation to the same words, for the race.
 *
 * @param supabase - the caller's RLS client
 * @param instance - the stopped instance
 * @returns true when another live enrolment holds its place
 */
export async function findLiveTwin(
  supabase: SupabaseClient<Database>,
  instance: { id: string; couple_id: string | null; dedupe_key: string | null; status: string },
): Promise<boolean> {
  if (!instance.dedupe_key || !instance.couple_id) return false;
  const { data } = await supabase
    .from('workflow_instances')
    .select('id, couple_id, dedupe_key, status')
    .eq('couple_id', instance.couple_id)
    .eq('dedupe_key', instance.dedupe_key);
  // The rule itself is pure and shared with the couple tab, which shows
  // "Running again" from the instances it already has.
  return hasLiveTwin(instance, data ?? []);
}

/**
 * Put a stopped workflow's cancelled steps back to `pending`, and date
 * them from today's data.
 *
 * Re-dated because nothing kept them current while stopped: the wedding
 * recompute (`_workflow_recompute_wedding_steps`) covers active and
 * paused instances only. A wedding moved earlier during the stop would
 * otherwise leave a step on its old, later date, the settle would pass
 * it, and the first recompute after resume would pull it into the past
 * and send it late. Dated first, the settle judges the real date.
 *
 * A step that was a sleeping `wait` comes back as an unstarted one: the
 * tick starts it again, so it waits its full time from the resume. That
 * sends later than planned, never retroactively.
 *
 * @param supabase - service-role client
 * @param instanceId - the stopped instance
 */
export async function restoreCancelledSteps(
  supabase: SupabaseClient<Database>,
  instanceId: string,
): Promise<void> {
  const { error } = await supabase
    .from('workflow_steps')
    .update({ status: 'pending' })
    .eq('instance_id', instanceId)
    .eq('status', 'cancelled');
  if (error) throw new Error(`restore cancelled steps: ${error.message}`);

  const { data, error: readError } = await supabase
    .from('workflow_instances')
    .select('*')
    .eq('id', instanceId)
    .maybeSingle();
  if (readError) throw new Error(`restore read instance: ${readError.message}`);
  const instance = data as unknown as WorkflowInstanceRow | null;
  // Strict: a re-date that silently did nothing leaves the old dates for
  // the settle to judge, which is the stale-date case this exists for.
  if (instance) await recomputeInstance(supabase, instance);
}

/**
 * Re-mark the open steps cancelled when the resume did not land.
 *
 * Only while the instance is still `cancelled`: if another resume won
 * the race, the instance is live and its steps are rightly open.
 *
 * @param supabase - service-role client
 * @param instanceId - the instance the resume failed to flip
 */
export async function undoRestore(
  supabase: SupabaseClient<Database>,
  instanceId: string,
): Promise<void> {
  const { data } = await supabase
    .from('workflow_instances')
    .select('status')
    .eq('id', instanceId)
    .maybeSingle();
  if (data?.status !== 'cancelled') return;
  await supabase
    .from('workflow_steps')
    .update({ status: 'cancelled' })
    .eq('instance_id', instanceId)
    .in('status', ['pending', 'waiting']);
}

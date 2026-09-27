/**
 * The executor's due-step read.
 *
 * One call to the `workflow_due_steps` SQL function (migration
 * 20261014000000), which applies every filter the executor needs,
 * including the account-wide stop, inside the database. Its own module
 * so the read is one seam: the executor calls it once per pass, and a
 * test can wrap it to land a stop between the read and the run.
 *
 * @module lib/workflows/due-steps
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';
import type { WorkflowStepRow } from '@/types/workflows';

import { AUTOMATED_STEP_TYPES } from './steps';

/** What {@link loadDueSteps} filters on. */
export interface DueStepsQuery {
  /** Steps due at or before this instant. */
  now: Date;
  /** At most this many rows, oldest first. */
  limit: number;
  /** Only this owner's instances (the scoped kick). */
  userId?: string | undefined;
}

/**
 * The due automated steps of active instances, oldest first, excluding
 * every account whose workflow stop is on.
 *
 * The stop is judged in SQL rather than by sending the list of stopped
 * accounts with the query. That list once rode in the request URL, and
 * a couple of hundred stopped accounts pushed it past the gateway limit:
 * the read failed and every tenant's workflows halted.
 *
 * Throws when the read fails. An empty array means nothing is due; a
 * failed read must never look like that, or the tick reports a healthy
 * pass while running nothing.
 *
 * @param supabase - service-role client (execute is revoked from every
 *   other role)
 * @param query - the cut-off, the batch size and the optional owner
 * @returns step rows in `due_at`, `instance_id`, `position` order
 */
export async function loadDueSteps(
  supabase: SupabaseClient<Database>,
  query: DueStepsQuery,
): Promise<WorkflowStepRow[]> {
  const { data, error } = await supabase.rpc('workflow_due_steps', {
    p_now: query.now.toISOString(),
    p_types: AUTOMATED_STEP_TYPES,
    p_limit: query.limit,
    ...(query.userId ? { p_user_id: query.userId } : {}),
  });
  if (error) throw new Error(`could not read due workflow steps: ${error.message}`);
  // The generated row types `status`, `type` and the JSON columns as
  // plain strings and Json; `WorkflowStepRow` narrows them to the
  // domain unions, which the table's CHECK constraints guarantee.
  return (data ?? []) as unknown as WorkflowStepRow[];
}

/**
 * Emit `workflow_completed` when a workflow finishes on a couple.
 *
 * The bus event behind the "Workflow completed" trigger
 * (`lib/automations/triggers`), which lets one workflow start when
 * another finishes (`lib/workflows/chain`). Emitted from the executor's
 * completion check, straight after the guarded write that moved the
 * instance to `completed`, so it fires once per completion and only for
 * one that landed.
 *
 * Only a real completion emits. A workflow stopped by the MC, an exit
 * rule or Turn off is `cancelled` or `paused` and never reaches here;
 * the per-couple "General" list and the personal workflow never
 * complete. An ad-hoc instance with no template behind it has nothing a
 * trigger could name, so it does not emit either.
 *
 * Never throws. The completion has already landed, and throwing would
 * send the caller down the unsettled path, whose heal skips a completed
 * instance: the event would be lost all the same, with a misleading
 * alert. A failed emit raises `workflow_chain_failed` instead.
 *
 * @module lib/workflows/emitters/workflow-completed
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { sendAlert } from '@/lib/alerts/send-alert';
import type { Database } from '@/types/database';
import type { WorkflowInstanceRow } from '@/types/workflows';

import { WORKFLOW_COMPLETED_EVENT, chainDepthOf } from '../chain';

/**
 * Write the `workflow_completed` bus event for a just-completed instance.
 *
 * @param supabase - service-role client (execute on the emitter is
 *   revoked from every other role)
 * @param instance - the instance that completed
 * @returns true when the event was written, false when it was not owed
 *   or could not be written
 */
export async function emitWorkflowCompleted(
  supabase: SupabaseClient<Database>,
  instance: WorkflowInstanceRow,
): Promise<boolean> {
  if (!instance.template_id || !instance.couple_id) return false;
  try {
    const { error } = await supabase.rpc('emit_automation_event', {
      p_user_id: instance.user_id,
      p_source_table: 'workflow_instances',
      p_source_id: instance.id,
      p_event_type: WORKFLOW_COMPLETED_EVENT,
      p_payload: {
        template_id: instance.template_id,
        instance_id: instance.id,
        couple_id: instance.couple_id,
        // The next workflow in the chain opens one level deeper
        // (`chainDepthForEvent`), which is what caps a loop.
        chain_depth: chainDepthOf(instance.context),
      },
      p_couple_id: instance.couple_id,
    });
    if (!error) return true;
    await reportEmitFailure(instance, error.message);
  } catch (err) {
    await reportEmitFailure(instance, err instanceof Error ? err.message : String(err));
  }
  return false;
}

/** Log and alert a lost event. Never throws. */
async function reportEmitFailure(instance: WorkflowInstanceRow, message: string): Promise<void> {
  console.error('[workflows] workflow_completed not emitted', instance.id, message);
  await sendAlert({
    type: 'workflow_chain_failed',
    severity: 'error',
    userId: instance.user_id,
    coupleId: instance.couple_id,
    instanceId: instance.id,
    reason: 'emit_failed',
    message,
  }).catch(() => undefined);
}

/**
 * Building the {@link RunContext} a step executes against.
 *
 * Deliberately thin. All the real snapshot loading (couple, MC, invoice,
 * contract) lives in `lib/automations/context.ts` and is reused verbatim,
 * because the action handlers, variable renderer and branch predicates
 * all read that exact shape. This module's only job is to present a
 * workflow instance and step in the shape that builder expects.
 *
 * @module lib/workflows/context
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { buildRunContext } from '@/lib/automations/context';
import type {
  AutomationEventRow,
  AutomationRunRow,
  RunContext,
} from '@/types/automations';
import type { Database } from '@/types/database';
import type { WorkflowInstanceRow, WorkflowStepRow } from '@/types/workflows';

/** Outputs of previously executed steps, keyed by step id. */
function stepOutputs(instance: WorkflowInstanceRow): Record<string, unknown> {
  const context = (instance.context ?? {}) as Record<string, unknown>;
  const outputs = context['step_outputs'];
  return typeof outputs === 'object' && outputs !== null
    ? (outputs as Record<string, unknown>)
    : {};
}

/**
 * A stand-in bus event for instances that were applied manually.
 *
 * `buildRunContext` needs an event: it reads `payload.invoice_id` to pick
 * which invoice the run is about, and every `{{...}}` template can
 * reference the trigger. A manually applied workflow has no triggering
 * event, so it gets an empty one rather than a null the callers would all
 * have to guard.
 */
function syntheticEvent(instance: WorkflowInstanceRow): AutomationEventRow {
  return {
    id: instance.id,
    user_id: instance.user_id,
    source_table: 'workflow_instances',
    source_id: instance.id,
    event_type: 'manual_fire',
    payload: {},
    couple_id: instance.couple_id,
    created_at: instance.applied_at,
    processed_at: null,
    error_message: null,
  };
}

/**
 * Build the execution context for one step.
 *
 * `automationId` carries the template id (or the instance id for an
 * ad-hoc instance) and `runId` the instance id, because in the unified
 * model the applied instance IS the run. Eight action handler modules
 * read those two fields; populating them keeps every handler working
 * with no change.
 */
export async function buildStepContext(
  supabase: SupabaseClient<Database>,
  instance: WorkflowInstanceRow,
  step: WorkflowStepRow,
): Promise<RunContext> {
  let event: AutomationEventRow | null = null;
  if (instance.trigger_event_id) {
    const { data } = await supabase
      .from('automation_events')
      .select('*')
      .eq('id', instance.trigger_event_id)
      .maybeSingle();
    event = (data as unknown as AutomationEventRow | null) ?? null;
  }

  const pseudoRun: AutomationRunRow = {
    id: instance.id,
    automation_id: instance.template_id ?? instance.id,
    event_id: instance.trigger_event_id ?? instance.id,
    user_id: instance.user_id,
    couple_id: instance.couple_id,
    status: 'running',
    current_action_id: step.id,
    started_at: instance.applied_at,
    completed_at: null,
    error_message: null,
    last_payload: { action_results: stepOutputs(instance) } as never,
  };

  const ctx = await buildRunContext(
    supabase,
    pseudoRun,
    event ?? syntheticEvent(instance),
  );

  return { ...ctx, instanceId: instance.id, stepId: step.id };
}

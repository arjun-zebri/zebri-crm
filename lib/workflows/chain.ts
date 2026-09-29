/**
 * Workflow chaining: one workflow starting another.
 *
 * Two ways in, both counted the same way:
 *
 * - the "Start workflow" step (`start_workflow`) opens the next workflow
 *   on the couple straight from inside the current one;
 * - the "Workflow completed" trigger (`workflow_completed`) starts a
 *   workflow when another one finishes.
 *
 * Every instance a chain opens records how far down the chain it is
 * (`context.chain_depth`), and nothing opens past {@link MAX_CHAIN_DEPTH}.
 * The per-couple dedupe already refuses a second live copy of a workflow,
 * which stops most cycles on its own; the depth cap is for the one it
 * cannot: a workflow set to allow re-applying, which A → B → A would
 * otherwise loop through once per tick, sending as it goes.
 *
 * Pure: no database, no React.
 *
 * @module lib/workflows/chain
 */

import type { AutomationEventRow } from '@/types/automations';

/**
 * How many workflows one chain may open in a row. An MC's real pipeline
 * (booked, planning, final details, the day, follow-up) is well under
 * this; a chain that reaches it is almost certainly a loop.
 */
export const MAX_CHAIN_DEPTH = 5;

/** The bus event a finished workflow emits, and the trigger that reads it. */
export const WORKFLOW_COMPLETED_EVENT = 'workflow_completed' as const;

/** The sentence the MC reads when a chain hits {@link MAX_CHAIN_DEPTH}. */
export const CHAIN_TOO_DEEP =
  `Too many workflows started one after another (more than ${MAX_CHAIN_DEPTH}). ` +
  'Check your workflows do not start each other in a loop.';

/** A non-negative integer read out of a jsonb field, or 0. */
function depthField(obj: unknown, key: string): number {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return 0;
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0;
}

/**
 * How far down a chain an instance is: 0 for one applied by hand or by
 * any trigger other than {@link WORKFLOW_COMPLETED_EVENT}.
 *
 * @param context - the instance's `context` jsonb
 */
export function chainDepthOf(context: unknown): number {
  return depthField(context, 'chain_depth');
}

/**
 * The depth a workflow opened by this event would sit at, or 0 when the
 * event is not part of a chain.
 *
 * Only a `workflow_completed` event continues a chain. Anything else (a
 * stage change the finished workflow made, say) starts a fresh one: the
 * database trigger that emits it cannot see who made the change.
 *
 * @param event - the bus event about to open an instance
 */
export function chainDepthForEvent(event: Pick<AutomationEventRow, 'event_type' | 'payload'>): number {
  if (event.event_type !== WORKFLOW_COMPLETED_EVENT) return 0;
  return depthField(event.payload, 'chain_depth') + 1;
}

/**
 * Is this step a Start workflow step? Read off the stored step, where the
 * action slug lives in `config.actionType`.
 *
 * @param step - a workflow step row
 */
export function isStartWorkflowStep(step: { type: string; config: unknown }): boolean {
  if (step.type !== 'action') return false;
  const config = step.config;
  if (typeof config !== 'object' || config === null || Array.isArray(config)) return false;
  return (config as Record<string, unknown>)['actionType'] === 'start_workflow';
}

/**
 * The workflow a finished Start workflow step opened, or null when it
 * opened none (already on the couple, stopped while it was built, or
 * turned off mid-build and left paused).
 *
 * @param output - the step's `output` jsonb
 */
export function startedInstanceId(output: unknown): string | null {
  if (typeof output !== 'object' || output === null || Array.isArray(output)) return null;
  const record = output as Record<string, unknown>;
  const id = record['instance_id'];
  return record['started'] === true && typeof id === 'string' ? id : null;
}

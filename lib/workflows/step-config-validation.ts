/**
 * Would the runner accept this step's config? Asked before it is saved.
 *
 * `executeStep` parses a step's config against its runner schema at
 * send time, and a config that fails becomes an errored step: the email
 * never went, and the MC finds out days later. Every path that saves a
 * step config (the builder canvas, the step detail modal's config form,
 * a held send's message edits, the copilot) runs this same check first,
 * so a blanked subject is refused at save. The sentence is
 * {@link configErrorMessage} in its `save` context: the same field
 * clause the send would have written, closing with "Fix this before
 * saving." rather than the send's "Edit the automation".
 *
 * This mirrors `executeStep`'s type switch deliberately. If the two
 * disagreed, a save could pass here and still fail at send (or be
 * refused here for a config that sends fine), so a change to one is a
 * change to both.
 *
 * Pure: no React, no database. Task 34's Turn on pre-flight reuses it
 * over a template's stored steps. It does import the action registry,
 * whose handlers are server-only, so it is for server code.
 *
 * @module lib/workflows/step-config-validation
 */

import { getActionSpec } from '@/lib/automations/actions';
import { branchConfigSchema, waitConfigSchema } from '@/lib/automations/conditions';
import { configErrorMessage, type ConfigErrorContext } from '@/lib/automations/config-errors';
import type { ActionType } from '@/types/automations';

/**
 * The save-time normalisation that runs before {@link validateStepConfig}:
 * a Wait's start offset is folded into its duration and its review flag
 * cleared, rather than refusing the save (a Wait has one number). Defined
 * in the client-safe `lib/workflows/wait-step`, because the step card
 * folds a legacy Wait the same way; re-exported here so every server save
 * path finds the normalise step next to the check it precedes.
 */
export { normalizeWaitStep } from '@/lib/workflows/wait-step';

/**
 * Why a config was refused, for a caller that acts on the kind of
 * problem rather than reading the sentence (the Turn on pre-flight):
 *
 * - `no_action`: an action step saved before its action was chosen;
 * - `not_runnable`: a step type or action the engine has no handler for;
 * - `removed`: the Stop step, which was taken out (the engine never had a
 *   handler for it) and will not come back;
 * - `invalid`: the config fails the runner's schema (a blank subject).
 */
export type StepConfigRefusal = 'no_action' | 'not_runnable' | 'removed' | 'invalid';

/** The verdict: fine to save, or the sentence and the reason why not. */
export type StepConfigCheck = { ok: true } | { ok: false; error: string; reason: StepConfigRefusal };

/** An action step saved before its action was chosen. */
export const NO_ACTION_CHOSEN = 'This step has no action chosen, so it cannot run. Choose one before saving.';

/** An action (or step type) the engine has no handler for. */
export const STEP_NOT_RUNNABLE = 'This step type is not available yet, so it cannot run. Remove it or pick another step.';

/**
 * A saved Stop step: at save, on the Turn on checklist, at send and on
 * the canvas card, one sentence. Stop was in the picker but the engine
 * never had a handler for it, so it was removed (Phase 6); a saved one is
 * refused with the way forward rather than "not available yet".
 */
export const STOP_NOT_A_STEP =
  "Stop isn't a step Zebri runs. Remove it; a workflow ends once its last step is done.";

/**
 * The fixed refusals, per context. The save wording is exported above and
 * pinned by tests; the checklist row already names the step, so its
 * wording is only the problem. The pre-flight tells the kinds apart by
 * the structured `reason`, never by these sentences, so they can change
 * freely.
 */
const FIXED_TEXT: Record<'noAction' | 'notRunnable' | 'removed', Record<ConfigErrorContext, string>> = {
  noAction: { save: NO_ACTION_CHOSEN, send: NO_ACTION_CHOSEN, checklist: 'No action chosen.' },
  notRunnable: { save: STEP_NOT_RUNNABLE, send: STEP_NOT_RUNNABLE, checklist: "This step type can't run yet." },
  removed: {
    save: STOP_NOT_A_STEP,
    send: STOP_NOT_A_STEP,
    checklist: STOP_NOT_A_STEP,
  },
};

/** Step types the MC ticks; the runner never parses their config. */
const MANUAL_TYPES = new Set(['todo', 'appointment']);

/**
 * Check a step's config the way the runner will read it.
 *
 * Takes the STORED pair: `type` is the column (`action`, `wait`,
 * `branch`, `todo`, `appointment`) and an action's slug lives in
 * `config.actionType`. The builder's slug form goes through
 * `splitStepType` first.
 *
 * Only checks; never rewrites. The caller saves the config it was given,
 * not the parsed one, so Zod defaults are applied at send exactly as
 * before rather than being frozen into the row.
 *
 * @param type - the stored step type
 * @param config - the config about to be written (null reads as empty)
 * @param context - who asks: a save (the default) or the Turn on
 *   pre-flight's checklist, which words the same verdict as one row
 * @returns `{ ok: true }`, or `{ ok: false, error }` with the sentence
 */
export function validateStepConfig(
  type: string,
  config: unknown,
  context: ConfigErrorContext = 'save',
): StepConfigCheck {
  const value = (config ?? {}) as Record<string, unknown>;

  if (MANUAL_TYPES.has(type)) return { ok: true };

  if (type === 'wait') {
    const parsed = waitConfigSchema.safeParse(value);
    return parsed.success
      ? { ok: true }
      : { ok: false, error: configErrorMessage('Wait', parsed.error, context), reason: 'invalid' };
  }

  if (type === 'branch') {
    const parsed = branchConfigSchema.safeParse(value);
    return parsed.success
      ? { ok: true }
      : { ok: false, error: configErrorMessage('Branch', parsed.error, context), reason: 'invalid' };
  }

  if (type === 'action') {
    const actionType = value['actionType'];
    if (typeof actionType !== 'string') {
      return { ok: false, error: FIXED_TEXT.noAction[context], reason: 'no_action' };
    }
    if (actionType === 'stop') return { ok: false, error: FIXED_TEXT.removed[context], reason: 'removed' };
    const spec = getActionSpec(actionType as ActionType);
    // The runner errors on these at send ("unknown action"): refusing the
    // save is the same answer, sooner (Task 33 ruling on unknown types).
    if (!spec) return { ok: false, error: FIXED_TEXT.notRunnable[context], reason: 'not_runnable' };
    const parsed = spec.configSchema.safeParse(value);
    return parsed.success
      ? { ok: true }
      : { ok: false, error: configErrorMessage(spec.ui.label, parsed.error, context), reason: 'invalid' };
  }

  return { ok: false, error: FIXED_TEXT.notRunnable[context], reason: 'not_runnable' };
}

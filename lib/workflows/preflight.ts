/**
 * The Turn on pre-flight: is this workflow finished enough to run?
 *
 * Nothing used to stop an unfinished workflow being turned on (audit
 * M7): a template with no steps, a send with no subject, a branch with no
 * condition, an appointment still called "Give it a name". Each of those
 * either errors when a couple reaches it or tells the MC nothing on the
 * day. This lists every such problem, one row per step, so Turn on can
 * refuse with the list and the canvas can badge the cards.
 *
 * The config verdict is {@link validateStepConfig}, the same parse the
 * saves use and the runner applies at send, in its `checklist` wording.
 * That module imports the action registry, whose handlers are server-only,
 * so the pre-flight runs on the server and client components receive the
 * plain {@link PreflightProblem} rows.
 *
 * @module lib/workflows/preflight
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { actionUi } from '@/lib/automations/actions/ui';
import type { ActionType } from '@/types/automations';
import type { Database } from '@/types/database';

import { throwIfReadFailed } from './read-failure';
import { STOP_NOT_A_STEP, validateStepConfig } from './step-config-validation';
import { stepDisplayTitle } from './step-label';

/** A template with nothing in it. */
export const NO_STEPS = 'It has no steps yet. Add at least one.';

/**
 * A to-do or appointment with no real name. Not an error: the step runs,
 * it just tells the MC nothing on the day.
 */
export const UNNAMED_STEP = "No name yet, so it won't say what to do on the day.";

/**
 * A step the engine has no working handler for yet: a coming-soon action
 * such as `send_sms`, or a type it does not know.
 */
export const CANNOT_RUN_YET = "This step type can't run yet.";

/**
 * A saved Stop step. Stop was taken out of the picker and the copilot
 * (the engine never had a handler for it, Phase 6), so the row says it is
 * gone and what to do, not that it "can't run yet".
 */
export const STOP_REMOVED = STOP_NOT_A_STEP;

/** How an unnamed manual step is named on its row, instead of its placeholder title. */
const MANUAL_LABEL: Record<string, string> = { todo: 'To-do', appointment: 'Appointment' };

/**
 * The name the canvas shows an unnamed manual step. It was being saved
 * as the title itself (seen live), so it counts as no name.
 */
const PLACEHOLDER_NAME = 'give it a name';

/** The manual step types, which are nothing without a name. */
const MANUAL_TYPES = new Set(['todo', 'appointment']);

/** The parts of a stored template step the pre-flight reads. */
export interface PreflightStepInput {
  id: string;
  /** The stored type (`action`, `wait`, `branch`, `todo`, `appointment`). */
  type: string;
  /** The stored title; empty for a step the MC did not name. */
  title: string | null;
  /** The stored config; an `action` carries its slug in `actionType`. */
  config: unknown;
}

/**
 * What sort of problem a row is, so a client can word the consequence
 * without importing this module (it pulls in the server-only registry):
 * `config` and `cannot_run` error at send, `unnamed` runs but says
 * nothing, `empty` is a workflow with no steps.
 */
export type PreflightProblemKind = 'empty' | 'config' | 'unnamed' | 'cannot_run';

/** One thing to finish before the workflow can be turned on. */
export interface PreflightProblem {
  /** The step to badge, or null for a problem with the whole workflow. */
  stepId: string | null;
  kind: PreflightProblemKind;
  /** What the step is called, as its card and the queue call it. */
  title: string;
  /** What is wrong, as one sentence. */
  message: string;
}

/**
 * The problem with one step, or null when it is ready.
 *
 * A coming-soon action is checked before its config: its schema accepts
 * a config the engine will still refuse at send (`send_sms` has no
 * provider), so a clean parse is not a promise here.
 */
function stepProblem(
  step: PreflightStepInput,
): { kind: PreflightProblemKind; message: string } | null {
  if (MANUAL_TYPES.has(step.type)) {
    const name = (step.title ?? '').trim().toLowerCase();
    return name === '' || name === PLACEHOLDER_NAME ? { kind: 'unnamed', message: UNNAMED_STEP } : null;
  }
  const config = (step.config ?? {}) as Record<string, unknown>;
  const actionType = config['actionType'];
  if (step.type === 'action' && typeof actionType === 'string') {
    if (actionUi[actionType as ActionType]?.comingSoon === true) {
      return { kind: 'cannot_run', message: CANNOT_RUN_YET };
    }
  }
  const check = validateStepConfig(step.type, config, 'checklist');
  if (check.ok) return null;
  // The validator's structured reason decides the kind, never its
  // sentence (Task 34 re-review Minor 7): rewording one must not quietly
  // turn "cannot run" into "bad config".
  const cannotRun = check.reason === 'not_runnable' || check.reason === 'removed';
  return { kind: cannotRun ? 'cannot_run' : 'config', message: check.error };
}

/**
 * Every problem with a template's steps, in the order given.
 *
 * Pure. An empty list means the workflow may be turned on.
 *
 * @param steps - the template's stored steps
 */
export function preflightSteps(steps: readonly PreflightStepInput[]): PreflightProblem[] {
  if (steps.length === 0) {
    return [{ stepId: null, kind: 'empty', title: 'This workflow', message: NO_STEPS }];
  }
  const problems: PreflightProblem[] = [];
  for (const step of steps) {
    const problem = stepProblem(step);
    if (problem === null) continue;
    problems.push({
      stepId: step.id,
      kind: problem.kind,
      // An unnamed step is named by its type: its stored title may be the
      // placeholder itself, which read "Give it a name has no name"
      // (Task 34 re-review Minor 6).
      title:
        problem.kind === 'unnamed'
          ? (MANUAL_LABEL[step.type] ?? 'Step')
          : stepDisplayTitle({ title: step.title, type: step.type, config: step.config }),
      message: problem.message,
    });
  }
  return problems;
}

/** What the pre-flight is guarding: a Turn on, or a hand apply to a couple. */
export type PreflightGate = 'turn_on' | 'apply';

/**
 * The refusal the server returns, naming each unfinished step.
 *
 * The canvas and library show the list before a Turn on reaches the
 * server; this sentence is for the click that races an edit, for the hand
 * apply (whose picker has no list), and for any caller without one.
 *
 * @param gate - what was refused, which decides the verb
 */
export function preflightRefusal(
  problems: readonly PreflightProblem[],
  gate: PreflightGate = 'turn_on',
): string {
  const verb = gate === 'apply' ? 'starting' : 'turning';
  const whole = problems.find((p) => p.stepId === null);
  if (whole) {
    const tail = gate === 'apply' ? 'starting it on a couple' : 'turning it on';
    return `Finish this workflow before ${tail}. ${whole.message}`;
  }
  const n = problems.length;
  const lines = problems.map((p) => `${p.title}: ${p.message}`).join(' ');
  const tail = gate === 'apply' ? `${verb} this on a couple` : `${verb} this on`;
  return `Finish ${n} ${n === 1 ? 'step' : 'steps'} before ${tail}. ${lines}`;
}

/**
 * A template's pre-flight, plus the revision it checked.
 *
 * `stepsRevision` is `workflow_templates.steps_revision`, which every
 * write to one of the template's steps bumps in its own transaction
 * (20261024200000). It is read BEFORE the steps, so a step written
 * between the two reads leaves this revision behind the table's and the
 * flip refuses; read after, such a write would be checked as absent and
 * let through. The Turn on passes it to `set_workflow_template_status`,
 * which compares it under the template's row lock (WF002), and the hand
 * apply passes it to `applyTemplate`, which compares it after its
 * snapshot read.
 */
export interface TemplatePreflight {
  problems: PreflightProblem[];
  /** The template's steps revision when the check began. */
  stepsRevision: number;
}

/**
 * Read a template's steps and run the pre-flight over them.
 *
 * RLS-scoped through the caller's client, so another tenant's template
 * reads as having no steps; callers check ownership first. A failed read
 * throws a `WorkflowReadError` rather than reading as "no steps": a Turn
 * on must not be refused, or allowed, on a read that never happened.
 *
 * @param supabase - the caller's client
 * @param templateId - the template to check
 */
export async function loadTemplatePreflight(
  supabase: SupabaseClient<Database>,
  templateId: string,
): Promise<TemplatePreflight> {
  // First: see the interface for why the order matters.
  const { data: template, error: templateError } = await supabase
    .from('workflow_templates')
    .select('steps_revision')
    .eq('id', templateId)
    .maybeSingle();
  throwIfReadFailed('preflight.load_revision', templateError);

  const { data, error } = await supabase
    .from('workflow_template_steps')
    .select('id, type, title, config, position, disabled')
    .eq('template_id', templateId)
    .order('position', { ascending: true })
    .order('id', { ascending: true });
  throwIfReadFailed('preflight.load_steps', error);
  const rows = data ?? [];
  return {
    // A disabled step is never copied onto a couple (instantiate.ts), so
    // it can neither error nor count as the workflow's one step.
    problems: preflightSteps(rows.filter((r) => !r.disabled)),
    // A template that is not there reads as revision 0; the flip then
    // refuses it as not found.
    stepsRevision: template?.steps_revision ?? 0,
  };
}

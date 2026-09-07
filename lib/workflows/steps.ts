/**
 * Step-type registry.
 *
 * One entry per step type the engine understands. The registry answers
 * the two questions the engine and the builder both need: is this step
 * something the engine executes on its own, and what does the builder
 * render for it.
 *
 * `action` steps carry the action slug in `config.actionType` and
 * delegate to the existing registry in `lib/automations/actions`. That
 * indirection is deliberate: it means every action handler, its Zod
 * schema, its composer modal and its templating keep working unchanged.
 *
 * @module lib/workflows/steps
 */

import type { StepType } from '@/types/workflows';

export interface StepSpec {
  type: StepType;
  /** Does the engine execute this without the MC touching it? */
  automated: boolean;
  /** Label shown in the builder's step picker. */
  label: string;
  /** One-line description for the picker tile. */
  description: string;
  /** Lucide icon name, rendered at strokeWidth 1.5. */
  icon: string;
}

export const stepRegistry: Record<StepType, StepSpec> = {
  todo: {
    type: 'todo',
    automated: false,
    label: 'To-do',
    description: 'Something you tick off yourself',
    icon: 'CheckSquare',
  },
  action: {
    type: 'action',
    automated: true,
    label: 'Automated action',
    description: 'Send an email, invoice or contract, or update the couple',
    icon: 'Zap',
  },
  wait: {
    type: 'wait',
    automated: true,
    label: 'Wait',
    description: 'Pause before the next step',
    icon: 'Timer',
  },
  branch: {
    type: 'branch',
    automated: true,
    label: 'Branch',
    description: 'Take one path or the other',
    icon: 'GitBranch',
  },
  appointment: {
    type: 'appointment',
    automated: false,
    label: 'Appointment',
    description: 'A dated meeting to hold in the diary',
    icon: 'CalendarClock',
  },
};

/** Look up a step spec by slug. Returns null for an unknown type. */
export function getStepSpec(type: string): StepSpec | null {
  return stepRegistry[type as StepType] ?? null;
}

/**
 * True when the engine executes this step type by itself.
 *
 * Manual types (`todo`, `appointment`) sit in `pending` until the MC
 * ticks them, and that is what gates everything anchored after them.
 * The executor's due-step query relies on this split.
 */
export function isAutomated(type: string): boolean {
  return getStepSpec(type)?.automated ?? false;
}

/**
 * The step types the executor can ever run, for its due-step query.
 *
 * Narrowing in SQL rather than in `isExecutable` alone: the query takes
 * the oldest due steps up to a budget, and a manual to-do is due
 * forever until a person ticks it. An MC carrying two hundred overdue
 * to-dos would otherwise fill every slot with work the engine cannot
 * do, and their sends would never run again.
 */
export const AUTOMATED_STEP_TYPES: StepType[] = Object.values(stepRegistry)
  .filter((spec) => spec.automated)
  .map((spec) => spec.type);

/* ─── the builder-canvas adapter ─────────────────────────────────── */

/** Step types the schema stores directly, rather than as an action. */
const NATIVE_STEP_TYPES = new Set<string>([
  'todo',
  'action',
  'wait',
  'branch',
  'appointment',
]);

/**
 * Split a builder slug into the stored `(type, config)` pair.
 *
 * The builder canvas thinks in action slugs (`send_email`); the schema
 * stores `type: 'action'` with the slug in `config.actionType`. Doing
 * the split here, at the data boundary, is what lets all forty-odd
 * builder components, their chips and their composer modals carry over
 * from the automations builder untouched.
 */
export function splitStepType(
  type: string,
  config: Record<string, unknown>,
): { type: StepType; config: Record<string, unknown> } {
  if (NATIVE_STEP_TYPES.has(type)) {
    return { type: type as StepType, config };
  }
  return { type: 'action', config: { ...config, actionType: type } };
}

/**
 * The inverse of {@link splitStepType}: the slug the builder canvas
 * expects for a stored step.
 */
export function joinStepType(
  type: string,
  config: Record<string, unknown> | null,
): string {
  if (type !== 'action') return type;
  const actionType = config?.['actionType'];
  return typeof actionType === 'string' ? actionType : 'action';
}

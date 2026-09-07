/**
 * Workflows domain types.
 *
 * Mirrors `supabase/migrations/20260905000000_create_workflows_foundation.sql`.
 * Row types here are hand-written for ergonomics; cross-check them against
 * the generated `Database['public']['Tables'][...]` types after the final
 * `supabase gen types` pass at the end of the batch.
 *
 * Terminology: a **template** is the reusable definition, an **instance**
 * is that template applied to one couple, and a **step** is one item in
 * either. An instance is also the run: the engine walks the instance's
 * snapshotted steps, not the template's. That single decision is what
 * lets a manual to-do and an automated email sit in one ordered list and
 * gate each other.
 *
 * @module types/workflows
 */

import type { Json } from './database';

/** The kinds of step a workflow can contain. */
export type StepType = 'todo' | 'action' | 'wait' | 'branch' | 'appointment';

/** How instances of a template get created automatically. */
export type ApplyRuleType =
  | 'manual'
  | 'on_couple_created'
  | 'on_stage_changed'
  | 'on_package_applied'
  | 'on_event';

/** Lifecycle of a template. */
export type TemplateStatus = 'draft' | 'active' | 'archived';

/** Lifecycle of an applied instance. */
export type InstanceStatus = 'active' | 'completed' | 'cancelled';

/** Lifecycle of one step inside an instance. */
export type StepStatus =
  | 'pending'
  | 'running'
  | 'waiting'
  | 'done'
  | 'skipped'
  | 'errored';

/** Statuses that mean the step will never run again. */
export const TERMINAL_STEP_STATUSES: readonly StepStatus[] = [
  'done',
  'skipped',
  'errored',
];

/**
 * When a step comes due, relative to an anchor.
 *
 * `after_previous` is the default and the reason manual to-dos can gate
 * automated steps: an automated step anchored to its predecessor has no
 * `due_at` until that predecessor is ticked or skipped.
 */
export type StepTiming =
  | {
      mode: 'wedding_relative';
      direction: 'before' | 'after';
      amount: number;
      unit: 'days' | 'weeks' | 'months';
    }
  | { mode: 'apply_relative'; amount: number; unit: 'days' | 'weeks' | 'months' }
  | { mode: 'after_previous'; delayAmount: number; unit: 'hours' | 'days' };

/** The timing every step gets when nothing else is chosen. */
export const DEFAULT_STEP_TIMING: StepTiming = {
  mode: 'after_previous',
  delayAmount: 0,
  unit: 'days',
};

export interface WorkflowTagRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
}

export interface WorkflowTemplateRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: TemplateStatus;
  apply_rule_type: ApplyRuleType;
  apply_rule_config: Json;
  allow_reapply: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  branch_depth_limit: number;
  canvas_viewport: Json;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowTemplateStepRow {
  id: string;
  template_id: string;
  position: number;
  type: StepType;
  config: Json;
  title: string;
  description: string | null;
  timing: StepTiming;
  parent_step_id: string | null;
  branch_path: 'yes' | 'no' | null;
  requires_approval: boolean;
  /** Show this step on the couple's portal. Opt-in; see the migration. */
  visible_to_couple: boolean;
  disabled: boolean;
  canvas_x: number;
  canvas_y: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowInstanceRow {
  id: string;
  user_id: string;
  couple_id: string | null;
  template_id: string | null;
  name: string;
  template_version: number | null;
  status: InstanceStatus;
  is_default: boolean;
  is_personal: boolean;
  trigger_event_id: string | null;
  context: Json;
  applied_at: string;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStepRow {
  id: string;
  instance_id: string;
  template_step_id: string | null;
  position: number;
  type: StepType;
  config: Json;
  title: string;
  description: string | null;
  timing: StepTiming;
  due_at: string | null;
  parent_step_id: string | null;
  branch_path: 'yes' | 'no' | null;
  status: StepStatus;
  requires_approval: boolean;
  /** Show this step on the couple's portal. Snapshotted from the template. */
  visible_to_couple: boolean;
  approval_token: string | null;
  approval_expires_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  output: Json | null;
  created_at: string;
  updated_at: string;
}

/** An instance with its steps loaded, ordered by position. */
export interface WorkflowInstanceWithSteps extends WorkflowInstanceRow {
  steps: WorkflowStepRow[];
}

/** Progress summary rendered as "step 7 of 20". */
export interface WorkflowProgress {
  done: number;
  total: number;
  /** Done over total, 0 to 100, rounded. Skipped steps count as done. */
  percent: number;
}

/* ─── tag colours ────────────────────────────────────────────────── */

/**
 * The palette a workflow tag can take.
 *
 * Named colours, not hex: the UI maps them onto a fixed set of classes
 * so tags stay on-palette in both themes and cannot drift off-token.
 * The same six the retiring task lookups used, so a converted tag keeps
 * the colour its task group had.
 */
export type TagColor = 'gray' | 'green' | 'blue' | 'amber' | 'red' | 'purple';

export const WORKFLOW_TAG_COLORS: readonly TagColor[] = [
  'gray',
  'green',
  'blue',
  'amber',
  'red',
  'purple',
];

/** Pill (background, text, ring) classes per tag colour. */
export const TAG_PILL_CLASS: Record<TagColor, string> = {
  gray: 'bg-gray-100 text-gray-600 ring-gray-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  amber: 'bg-amber-50 text-amber-800 ring-amber-100',
  red: 'bg-red-50 text-red-700 ring-red-100',
  purple: 'bg-purple-50 text-purple-700 ring-purple-100',
};

/** Solid swatch, for the colour picker chips. */
export const TAG_DOT_CLASS: Record<TagColor, string> = {
  gray: 'bg-gray-300',
  green: 'bg-emerald-400',
  blue: 'bg-blue-400',
  amber: 'bg-amber-400',
  red: 'bg-red-400',
  purple: 'bg-purple-400',
};

/**
 * Coerce a stored colour string to a known {@link TagColor}.
 *
 * Defaults to `gray` for anything unrecognised, so a tag whose colour
 * was written by an older build still renders rather than crashing the
 * list it appears in.
 */
export function toTagColor(value: string): TagColor {
  return (WORKFLOW_TAG_COLORS as readonly string[]).includes(value)
    ? (value as TagColor)
    : 'gray';
}

/**
 * Adapters between the stored workflow rows and the shapes the builder
 * canvas speaks.
 *
 * The canvas and its forty components were written against
 * `AutomationRow` / `AutomationActionRow`, where a node's `type` is the
 * action slug and the parent link is `parent_action_id`. The workflows
 * schema stores a small `type` enum plus `config.actionType`, and calls
 * the link `parent_step_id`.
 *
 * Translating once here, at the read boundary, is what lets the whole
 * builder carry over untouched: the chips, the composer modals, the
 * inspector, the auto-layout and the copilot all keep working against
 * the shape they already know. The write direction lives in
 * `../actions.ts` (`splitStepType`).
 *
 * @module app/(dashboard)/workflows/[id]/adapt
 */

import { splitApplyRule } from '@/lib/workflows/apply-rules';
import type {
  ActionType,
  AutomationRow,
  AutomationStatus,
  BranchPath,
  TriggerType,
} from '@/types/automations';
import type { AutomationActionRow } from '@/types/automations';
import type { Json } from '@/types/database';

/** A `workflow_template_steps` row as it comes back from PostgREST. */
export interface StoredTemplateStep {
  id: string;
  template_id: string;
  position: number;
  type: string;
  config: Json;
  title: string | null;
  description: string | null;
  timing: Json;
  parent_step_id: string | null;
  branch_path: string | null;
  requires_approval: boolean;
  visible_to_couple: boolean;
  disabled: boolean;
  canvas_x: number | null;
  canvas_y: number | null;
  created_at: string;
  updated_at: string;
}

/** A `workflow_templates` row as it comes back from PostgREST. */
export interface StoredTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: string;
  apply_rule_type: string;
  apply_rule_config: Json;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  branch_depth_limit: number;
  version: number;
  created_at: string;
  updated_at: string;
}

/**
 * The node type the canvas expects.
 *
 * An `action` step carries its real slug in `config.actionType`;
 * everything else is its own node type already.
 */
export function builderNodeType(step: StoredTemplateStep): string {
  if (step.type !== 'action') return step.type;
  const config = step.config as Record<string, unknown> | null;
  const actionType = config?.['actionType'];
  return typeof actionType === 'string' ? actionType : 'action';
}

/**
 * Lift the stored `description` column back into `config`.
 *
 * The write path (`upsertTemplateStepRow`) pulls `config.description`
 * out into its own column, because that is where the applied instance
 * and the couple's checklist read a step's note from. Nothing put it
 * back on the way in, so every manual step's note read as empty the
 * next time the builder loaded.
 */
function configWithDescription(config: Json, description: string | null): Json {
  if (!description) return config;
  const base = (config ?? {}) as Record<string, unknown>;
  return { ...base, description } as Json;
}

/** Present one stored step in the shape the canvas reads. */
export function toBuilderStep(step: StoredTemplateStep): AutomationActionRow {
  return {
    id: step.id,
    automation_id: step.template_id,
    position: step.position,
    type: builderNodeType(step) as ActionType,
    config: configWithDescription(step.config, step.description),
    parent_action_id: step.parent_step_id,
    branch_path: (step.branch_path ?? null) as BranchPath | null,
    label: step.title && step.title.length > 0 ? step.title : null,
    disabled: step.disabled,
    position_x: step.canvas_x,
    position_y: step.canvas_y,
    timing: step.timing,
    requires_approval: step.requires_approval,
    visible_to_couple: step.visible_to_couple,
    created_at: step.created_at,
    updated_at: step.updated_at,
  };
}

/** Present one stored template in the shape the canvas header reads. */
export function toBuilderTemplate(template: StoredTemplate): AutomationRow {
  const rule = splitApplyRule(template.apply_rule_type, template.apply_rule_config);
  return {
    id: template.id,
    user_id: template.user_id,
    name: template.name,
    description: template.description,
    // The stored model has five apply rules; the canvas speaks the whole
    // trigger registry. `splitApplyRule` unwraps the one that nests a
    // trigger (`on_event`) and turns "no automatic rule" into the canvas's
    // `unset`, which renders the "set when this applies" placeholder.
    trigger_type: rule.triggerType as TriggerType,
    trigger_config: rule.triggerConfig as Json,
    status: template.status as AutomationStatus,
    // Workflow templates have no recipe-library slug; the field stays in
    // the builder's shape so nothing downstream has to change.
    template_slug: null,
    quiet_hours_start: template.quiet_hours_start,
    quiet_hours_end: template.quiet_hours_end,
    branch_depth_limit: template.branch_depth_limit,
    version: template.version,
    created_at: template.created_at,
    updated_at: template.updated_at,
  };
}

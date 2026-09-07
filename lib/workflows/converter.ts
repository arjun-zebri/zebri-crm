/**
 * One-time conversion of the legacy Tasks and Automations data into the
 * unified Workflows model, for a single user.
 *
 * The shipping path is the SQL migration
 * `20260906000000_workflows_converter.sql`, which runs for every user
 * through the CI deploy. This module is its faithful mirror: it is what
 * the integration test drives, and what to reach for when one account's
 * conversion has to be re-run.
 *
 * Both are idempotent through the same mechanism, the `legacy_*_id`
 * provenance columns, so running this after the migration converts
 * nothing twice.
 *
 * @module lib/workflows/converter
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { zonedTimeToUtc } from '@/lib/scheduling/timezone';
import type { Database, Json } from '@/types/database';

/** Fallback when the MC has never saved a timezone. */
const DEFAULT_TIMEZONE = 'Australia/Sydney';

/** Timing every converted step gets: a legacy chain was implicitly sequential. */
const SEQUENTIAL_TIMING = {
  mode: 'after_previous',
  delayAmount: 0,
  unit: 'days',
} as const;

/** Vertical spacing used when a legacy action had no saved canvas position. */
const FALLBACK_ROW_HEIGHT = 160;

/** What the conversion did, and what it could not carry over. */
export interface ConversionReport {
  tasksConverted: number;
  tasksSkipped: number;
  automationsConverted: number;
  activeTemplates: number;
  draftTemplates: number;
  /** Everything the new model drops or refuses to guess at, named. */
  warnings: string[];
}

type Client = SupabaseClient<Database>;

interface LegacyTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  position: number;
  priority: string | null;
  task_type: string | null;
  group_id: string | null;
  related_couple_id: string | null;
  created_at: string;
}

interface LegacyAutomation {
  id: string;
  name: string;
  description: string | null;
  status: string;
  trigger_type: string;
  trigger_config: Json;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  branch_depth_limit: number;
  template_slug: string | null;
  version: number;
  created_at: string;
}

interface LegacyAction {
  id: string;
  automation_id: string;
  position: number;
  type: string;
  config: Json;
  label: string | null;
  parent_action_id: string | null;
  branch_path: string | null;
  disabled: boolean;
  position_x: number | null;
  position_y: number | null;
  created_at: string;
}

/** The MC's working timezone, falling back to Sydney. */
async function loadTimezone(supabase: Client, userId: string): Promise<string> {
  const { data } = await supabase
    .from('user_public_settings')
    .select('timezone')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.timezone ?? DEFAULT_TIMEZONE;
}

/**
 * Make sure every one of the user's couples has a default instance.
 *
 * The couples INSERT trigger covers new couples; couples that predate it
 * have none, and a converted task with nowhere to land would vanish.
 */
async function ensureDefaultInstances(
  supabase: Client,
  userId: string,
): Promise<Map<string, string>> {
  const { data: couples } = await supabase
    .from('couples')
    .select('id')
    .eq('user_id', userId);

  const { data: existing } = await supabase
    .from('workflow_instances')
    .select('id, couple_id')
    .eq('user_id', userId)
    .eq('is_default', true);

  const byCouple = new Map<string, string>();
  for (const row of existing ?? []) {
    if (row.couple_id) byCouple.set(row.couple_id, row.id);
  }

  const missing = (couples ?? []).filter((c) => !byCouple.has(c.id));
  if (missing.length > 0) {
    // Uniform keys on every row: a ragged array insert silently drops rows.
    const { data: created } = await supabase
      .from('workflow_instances')
      .insert(
        missing.map((c) => ({
          user_id: userId,
          couple_id: c.id,
          name: 'General',
          is_default: true,
        })),
      )
      .select('id, couple_id');
    for (const row of created ?? []) {
      if (row.couple_id) byCouple.set(row.couple_id, row.id);
    }
  }

  return byCouple;
}

/** The user's personal (couple-less) instance, created if absent. */
async function ensurePersonalInstanceId(
  supabase: Client,
  userId: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('workflow_instances')
    .select('id')
    .eq('user_id', userId)
    .eq('is_personal', true)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created } = await supabase
    .from('workflow_instances')
    .insert({ user_id: userId, name: 'My to-dos', is_personal: true })
    .select('id')
    .single();
  return created?.id ?? null;
}

/** Convert the user's tasks into to-do steps. Mutates `warnings`. */
async function convertTasks(
  supabase: Client,
  userId: string,
  warnings: string[],
): Promise<{ converted: number; skipped: number }> {
  const { data: tasks } = await supabase
    .from('tasks')
    .select(
      'id, title, description, due_date, status, position, priority, task_type, group_id, related_couple_id, created_at',
    )
    .eq('user_id', userId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  const rows = (tasks ?? []) as LegacyTask[];
  if (rows.length === 0) return { converted: 0, skipped: 0 };

  const timezone = await loadTimezone(supabase, userId);
  const byCouple = await ensureDefaultInstances(supabase, userId);
  const needsPersonal = rows.some((t) => t.related_couple_id === null);
  const personalId = needsPersonal
    ? await ensurePersonalInstanceId(supabase, userId)
    : null;

  const { data: already } = await supabase
    .from('workflow_steps')
    .select('legacy_task_id')
    .not('legacy_task_id', 'is', null);
  const done = new Set((already ?? []).map((r) => r.legacy_task_id));

  // Position is renumbered per instance so the checklist reads in the
  // MC's order with no gaps.
  const nextPosition = new Map<string, number>();
  const inserts: Database['public']['Tables']['workflow_steps']['Insert'][] = [];
  let skipped = 0;

  for (const task of rows) {
    if (task.priority || task.task_type || task.group_id) {
      warnings.push(
        `Task ${task.id} (${task.title}): dropped priority=${task.priority ?? '-'} ` +
          `task_type=${task.task_type ?? '-'} group_id=${task.group_id ?? '-'}. ` +
          'Steps are checklist-simple.',
      );
    }

    const instanceId = task.related_couple_id
      ? byCouple.get(task.related_couple_id)
      : personalId;

    if (!instanceId) {
      // The couple was deleted out from under the task. Skipping beats
      // guessing at a home for it.
      skipped += 1;
      warnings.push(
        `Task ${task.id} (${task.title}) skipped: its couple no longer exists.`,
      );
      continue;
    }

    if (done.has(task.id)) continue;

    const position = (nextPosition.get(instanceId) ?? 0) + 1;
    nextPosition.set(instanceId, position);

    inserts.push({
      instance_id: instanceId,
      legacy_task_id: task.id,
      position,
      type: 'todo',
      config: {},
      title: task.title,
      description: task.description,
      timing: SEQUENTIAL_TIMING,
      // A date read at midnight in the MC's zone. A plain UTC parse moves
      // an Australian task onto the previous day.
      due_at: task.due_date
        ? zonedTimeToUtc(task.due_date, '00:00', timezone).toISOString()
        : null,
      // Every legacy status, built-in or custom, collapses to the
      // checklist binary. That simplification is the point.
      status: task.status === 'done' ? 'done' : 'pending',
      completed_at: task.status === 'done' ? task.created_at : null,
      created_at: task.created_at,
    });
  }

  if (inserts.length === 0) return { converted: 0, skipped };

  const { data: created, error } = await supabase
    .from('workflow_steps')
    .insert(inserts)
    .select('id');
  if (error) {
    warnings.push(`Task conversion failed: ${error.message}`);
    return { converted: 0, skipped };
  }
  return { converted: created?.length ?? 0, skipped };
}

/** Convert one automation's actions into template steps. */
async function convertActions(
  supabase: Client,
  templateId: string,
  actions: LegacyAction[],
  warnings: string[],
): Promise<void> {
  if (actions.length === 0) return;

  const { data: already } = await supabase
    .from('workflow_template_steps')
    .select('legacy_action_id')
    .eq('template_id', templateId)
    .not('legacy_action_id', 'is', null);
  const done = new Set((already ?? []).map((r) => r.legacy_action_id));

  const pending = actions.filter((a) => !done.has(a.id));
  if (pending.length === 0) return;

  // Parents are wired in a second pass: inserting children against a
  // self-referencing foreign key would depend on row ordering.
  const { error } = await supabase.from('workflow_template_steps').insert(
    pending.map((a) => ({
      template_id: templateId,
      legacy_action_id: a.id,
      position: a.position,
      type: a.type === 'wait' || a.type === 'branch' ? a.type : 'action',
      config:
        a.type === 'wait' || a.type === 'branch'
          ? ((a.config ?? {}) as Json)
          : ({
              ...((a.config ?? {}) as Record<string, unknown>),
              actionType: a.type,
            } as Json),
      title: a.label ?? '',
      timing: SEQUENTIAL_TIMING,
      requires_approval: false,
      disabled: a.disabled,
      canvas_x: a.position_x ?? 0,
      canvas_y: a.position_y ?? a.position * FALLBACK_ROW_HEIGHT,
      created_at: a.created_at,
    })),
  );
  if (error) {
    warnings.push(`Steps for template ${templateId} failed: ${error.message}`);
    return;
  }

  const { data: saved } = await supabase
    .from('workflow_template_steps')
    .select('id, legacy_action_id')
    .eq('template_id', templateId)
    .not('legacy_action_id', 'is', null);
  const byLegacy = new Map<string, string>();
  for (const row of saved ?? []) {
    if (row.legacy_action_id) byLegacy.set(row.legacy_action_id, row.id);
  }

  for (const action of pending) {
    if (!action.parent_action_id || !action.branch_path) continue;
    const id = byLegacy.get(action.id);
    const parentId = byLegacy.get(action.parent_action_id);
    if (!id || !parentId) continue;
    await supabase
      .from('workflow_template_steps')
      .update({
        parent_step_id: parentId,
        branch_path: action.branch_path,
      })
      .eq('id', id);
  }
}

/** Convert the user's automations into templates. Mutates `warnings`. */
async function convertAutomations(
  supabase: Client,
  userId: string,
  warnings: string[],
): Promise<{ converted: number; active: number; draft: number }> {
  const { data: automations } = await supabase
    .from('automations')
    .select(
      'id, name, description, status, trigger_type, trigger_config, quiet_hours_start, quiet_hours_end, branch_depth_limit, template_slug, version, created_at',
    )
    .eq('user_id', userId);

  const rows = (automations ?? []) as LegacyAutomation[];
  if (rows.length === 0) return { converted: 0, active: 0, draft: 0 };

  const { data: already } = await supabase
    .from('workflow_templates')
    .select('id, legacy_automation_id')
    .eq('user_id', userId)
    .not('legacy_automation_id', 'is', null);
  const byLegacy = new Map<string, string>();
  for (const row of already ?? []) {
    if (row.legacy_automation_id) byLegacy.set(row.legacy_automation_id, row.id);
  }

  const missing = rows.filter((a) => !byLegacy.has(a.id));
  if (missing.length > 0) {
    const { data: created, error } = await supabase
      .from('workflow_templates')
      .insert(
        missing.map((a) => ({
          user_id: userId,
          legacy_automation_id: a.id,
          name: a.name,
          description: a.description,
          // Draft, paused and archived all land as draft: a converted
          // workflow the MC can open, read and activate beats an archived
          // one they cannot touch.
          status: a.status === 'active' ? 'active' : 'draft',
          // Every legacy trigger keeps working through the on_event rule,
          // which matches an automation_events row by type.
          apply_rule_type: 'on_event',
          apply_rule_config: {
            eventType: a.trigger_type,
            triggerConfig: a.trigger_config,
          } as Json,
          quiet_hours_start: a.quiet_hours_start,
          quiet_hours_end: a.quiet_hours_end,
          branch_depth_limit: a.branch_depth_limit,
          template_slug: a.template_slug,
          version: a.version,
          created_at: a.created_at,
        })),
      )
      .select('id, legacy_automation_id');
    if (error) {
      warnings.push(`Automation conversion failed: ${error.message}`);
    }
    for (const row of created ?? []) {
      if (row.legacy_automation_id) byLegacy.set(row.legacy_automation_id, row.id);
    }
  }

  const { data: actions } = await supabase
    .from('automation_actions')
    .select(
      'id, automation_id, position, type, config, label, parent_action_id, branch_path, disabled, position_x, position_y, created_at',
    )
    .in('automation_id', rows.map((a) => a.id))
    .order('position', { ascending: true });

  const byAutomation = new Map<string, LegacyAction[]>();
  for (const action of (actions ?? []) as LegacyAction[]) {
    const list = byAutomation.get(action.automation_id) ?? [];
    list.push(action);
    byAutomation.set(action.automation_id, list);
  }

  for (const automation of rows) {
    const templateId = byLegacy.get(automation.id);
    if (!templateId) continue;
    await convertActions(
      supabase,
      templateId,
      byAutomation.get(automation.id) ?? [],
      warnings,
    );
  }

  return {
    converted: missing.length,
    active: rows.filter((a) => a.status === 'active').length,
    draft: rows.filter((a) => a.status !== 'active').length,
  };
}

/**
 * Convert one user's legacy tasks and automations. Idempotent: a second
 * run converts nothing, because every converted row carries the id of the
 * legacy row it came from.
 */
export async function convertLegacyData(
  supabase: Client,
  userId: string,
): Promise<ConversionReport> {
  const warnings: string[] = [];

  const tasks = await convertTasks(supabase, userId, warnings);
  const automations = await convertAutomations(supabase, userId, warnings);

  // Runs are deliberately not converted: an applied instance IS the run in
  // the new model, and there is no faithful mapping from a half-walked
  // action DAG onto a snapshot. Naming them beats silently dropping them.
  const { data: inFlight } = await supabase
    .from('automation_runs')
    .select('id, automation_id')
    .eq('user_id', userId)
    .in('status', ['running', 'waiting', 'paused']);
  for (const run of inFlight ?? []) {
    warnings.push(
      `Automation run ${run.id} (automation ${run.automation_id}) was in flight and was NOT converted.`,
    );
  }

  return {
    tasksConverted: tasks.converted,
    tasksSkipped: tasks.skipped,
    automationsConverted: automations.converted,
    activeTemplates: automations.active,
    draftTemplates: automations.draft,
    warnings,
  };
}

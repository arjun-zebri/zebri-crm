/**
 * Applying a template to a couple.
 *
 * This is the one place the template-to-instance copy happens. It
 * **snapshots**: the instance's steps are independent rows, so editing or
 * deleting a template step afterwards never touches a couple's live
 * progress. That is Dubsado's safety property, and it avoids the Studio
 * Ninja bug where editing a workflow resets everyone's progress.
 *
 * @module lib/workflows/instantiate
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';
import type {
  StepTiming,
  StepType,
  WorkflowStepRow,
  WorkflowTemplateStepRow,
} from '@/types/workflows';
import { DEFAULT_STEP_TIMING } from '@/types/workflows';

import { writeAudit } from './audit';
import { recomputeDueDates } from './timing';

/** Fallback when the MC has never saved a timezone. */
const DEFAULT_TIMEZONE = 'Australia/Sydney';

export interface ApplyTemplateOptions {
  userId: string;
  templateId: string;
  /** Null for a personal (couple-less) instance. */
  coupleId: string | null;
  /** The bus event that triggered an automatic apply, when there was one. */
  triggerEventId?: string | null;
  /** Overrides the instance name; defaults to the template's name. */
  name?: string;
  /**
   * Refuse to apply when this template is already live on this couple.
   *
   * The dispatcher passes true: an automatic re-apply means duplicate
   * emails. The manual picker passes false, because an MC asking for a
   * second copy is making a deliberate choice.
   */
  dedupe?: boolean;
}

export type ApplyTemplateResult = { instanceId: string } | { error: string };

/** Read the MC's working timezone, falling back to Sydney. */
async function loadTimezone(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from('user_public_settings')
    .select('timezone')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.timezone ?? DEFAULT_TIMEZONE;
}

/**
 * The couple's wedding date, or null when there is no couple.
 *
 * Event date and venue live on the couple's `events` rows (managed via
 * the Events tab); the couple-level `event_date` column is only populated
 * for pre-events-table couples. This mirrors the resolution
 * `loadCoupleSnapshot` already uses, so a step's due date and an email's
 * `{{event.date}}` can never disagree.
 */
export async function loadWeddingDate(
  supabase: SupabaseClient<Database>,
  coupleId: string | null,
): Promise<string | null> {
  if (!coupleId) return null;
  const [{ data: primaryEvent }, { data: couple }] = await Promise.all([
    supabase
      .from('events')
      .select('date')
      .eq('couple_id', coupleId)
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase.from('couples').select('event_date').eq('id', coupleId).maybeSingle(),
  ]);
  return primaryEvent?.date ?? couple?.event_date ?? null;
}

/**
 * Apply a template to a couple, snapshotting its steps.
 *
 * @returns the new instance's id, or an error describing why not
 */
export async function applyTemplate(
  supabase: SupabaseClient<Database>,
  opts: ApplyTemplateOptions,
): Promise<ApplyTemplateResult> {
  const { data: template } = await supabase
    .from('workflow_templates')
    .select('*')
    .eq('id', opts.templateId)
    .eq('user_id', opts.userId)
    .maybeSingle();

  if (!template) return { error: 'template not found' };
  if (template.status === 'archived') {
    return { error: 'template is archived' };
  }

  if (opts.dedupe && !template.allow_reapply && opts.coupleId) {
    const { data: existing } = await supabase
      .from('workflow_instances')
      .select('id')
      .eq('template_id', opts.templateId)
      .eq('couple_id', opts.coupleId)
      .neq('status', 'cancelled')
      .limit(1);
    if (existing && existing.length > 0) {
      return { error: 'already applied to this couple' };
    }
  }

  const [timezone, weddingDate] = await Promise.all([
    loadTimezone(supabase, opts.userId),
    loadWeddingDate(supabase, opts.coupleId),
  ]);

  const appliedAt = new Date().toISOString();

  const { data: instance, error: instanceError } = await supabase
    .from('workflow_instances')
    .insert({
      user_id: opts.userId,
      couple_id: opts.coupleId,
      template_id: opts.templateId,
      name: opts.name ?? template.name,
      template_version: template.version,
      trigger_event_id: opts.triggerEventId ?? null,
      applied_at: appliedAt,
    })
    .select('id')
    .single();

  if (instanceError || !instance) {
    return { error: instanceError?.message ?? 'could not create instance' };
  }

  const { data: templateSteps } = await supabase
    .from('workflow_template_steps')
    .select('*')
    .eq('template_id', opts.templateId)
    .eq('disabled', false)
    .order('position', { ascending: true });

  const source = (templateSteps ?? []) as unknown as WorkflowTemplateStepRow[];

  // Parents before children, so a child's parent_step_id can be remapped
  // from the template step id to the newly inserted instance step id.
  const roots = source.filter((s) => s.parent_step_id === null);
  const children = source.filter((s) => s.parent_step_id !== null);

  /** Template step id to instance step id. */
  const idMap = new Map<string, string>();

  const insertLayer = async (
    layer: WorkflowTemplateStepRow[],
  ): Promise<string | null> => {
    if (layer.length === 0) return null;
    // Uniform keys on every row: a supabase-js array insert whose rows
    // have differing key sets silently drops rows rather than erroring.
    const rows = layer.map((s) => ({
      instance_id: instance.id,
      template_step_id: s.id,
      position: s.position,
      type: s.type as StepType,
      config: s.config,
      title: s.title,
      description: s.description,
      timing: (s.timing ?? DEFAULT_STEP_TIMING) as unknown as StepTiming,
      parent_step_id: s.parent_step_id ? (idMap.get(s.parent_step_id) ?? null) : null,
      branch_path: s.branch_path,
      requires_approval: s.requires_approval,
      visible_to_couple: s.visible_to_couple,
      status: 'pending' as const,
      due_at: null,
    }));
    const { data, error } = await supabase
      .from('workflow_steps')
      .insert(rows as never)
      .select('id, template_step_id');
    if (error) return error.message;
    if (!data || data.length !== layer.length) {
      return `snapshot inserted ${data?.length ?? 0} of ${layer.length} steps`;
    }
    for (const row of data) {
      if (row.template_step_id) idMap.set(row.template_step_id, row.id);
    }
    return null;
  };

  const rootError = await insertLayer(roots);
  if (rootError) return { error: rootError };
  const childError = await insertLayer(children);
  if (childError) return { error: childError };

  const { data: inserted } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('instance_id', instance.id);

  const steps = (inserted ?? []) as unknown as WorkflowStepRow[];
  const patch = recomputeDueDates(steps, { weddingDate, appliedAt, timezone });
  await Promise.all(
    patch
      .filter((p) => p.due_at !== null)
      .map((p) =>
        supabase.from('workflow_steps').update({ due_at: p.due_at }).eq('id', p.id),
      ),
  );

  await writeAudit(supabase, {
    userId: opts.userId,
    instanceId: instance.id,
    coupleId: opts.coupleId,
    event: 'instance_created',
    detail: { templateId: opts.templateId, stepCount: steps.length },
  });

  return { instanceId: instance.id };
}

/**
 * The couple's default ("General") instance, created if absent.
 *
 * A DB trigger creates it on couple INSERT, so this is a safety net for
 * couples that predate the trigger. Relies on the partial unique index
 * `workflow_instances_one_default_per_couple_idx` for the race.
 */
export async function ensureDefaultInstance(
  supabase: SupabaseClient<Database>,
  userId: string,
  coupleId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from('workflow_instances')
    .select('id')
    .eq('couple_id', coupleId)
    .eq('is_default', true)
    .maybeSingle();
  if (existing) return existing.id;

  const { data } = await supabase
    .from('workflow_instances')
    .insert({ user_id: userId, couple_id: coupleId, name: 'General', is_default: true })
    .select('id')
    .maybeSingle();
  if (data) return data.id;

  // Lost the race against the unique index; the winner's row is there now.
  const { data: raced } = await supabase
    .from('workflow_instances')
    .select('id')
    .eq('couple_id', coupleId)
    .eq('is_default', true)
    .single();
  return raced!.id;
}

/**
 * The user's personal (couple-less) instance, created if absent.
 *
 * Home for to-dos that belong to no couple. It surfaces only in the work
 * queue, never on a couple profile.
 */
export async function ensurePersonalInstance(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from('workflow_instances')
    .select('id')
    .eq('user_id', userId)
    .eq('is_personal', true)
    .maybeSingle();
  if (existing) return existing.id;

  const { data } = await supabase
    .from('workflow_instances')
    .insert({ user_id: userId, name: 'My to-dos', is_personal: true })
    .select('id')
    .maybeSingle();
  if (data) return data.id;

  const { data: raced } = await supabase
    .from('workflow_instances')
    .select('id')
    .eq('user_id', userId)
    .eq('is_personal', true)
    .single();
  return raced!.id;
}

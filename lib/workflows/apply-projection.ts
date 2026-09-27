/**
 * The Start preview: a workflow's calendar for one couple, before it
 * starts, with the steps the apply will skip flagged.
 *
 * Pure. The steps are dated with the same `recomputeDueDates` the apply
 * uses, and the skips come from the same plan `settlePastOnApply` writes
 * (`./apply-skips`), so a row flagged "will be skipped" is exactly a step
 * the apply skips. Nothing here is written anywhere.
 *
 * @module lib/workflows/apply-projection
 */

import { z } from 'zod';

import { zonedDateParts } from '@/lib/scheduling/timezone';
import {
  DEFAULT_STEP_TIMING,
  type StepTiming,
  type StepType,
  type WorkflowStepRow,
  type WorkflowTemplateStepRow,
} from '@/types/workflows';

import { planApplySkips } from './apply-skips';
import { stepDisplayTitle } from './step-label';
import { isAutomated } from './steps';
import { recomputeDueDates, type InstanceAnchors } from './timing';
import { describeTiming, toStepTiming } from './timing-summary';

/** Input for the preview server action. Kept out of the `'use server'` file. */
export const previewApplyInputSchema = z.object({
  templateId: z.string().uuid(),
  coupleId: z.string().uuid(),
});

/**
 * What a row will do once the workflow starts:
 * - `skipped_past`: its date has already passed, so the apply skips it;
 * - `needs_wedding_date`: wedding-dated, and the couple has no date yet;
 * - `manual`: a to-do or appointment, the MC's to tick off;
 * - `scheduled`: runs on its date, or when the step above it is done.
 */
export type ApplyPreviewFlag = 'skipped_past' | 'manual' | 'needs_wedding_date' | 'scheduled';

/** One step in the preview. */
export interface ApplyPreviewRow {
  id: string;
  title: string;
  type: StepType;
  /** Local `YYYY-MM-DD` in the MC's timezone, or null when not dated yet. */
  date: string | null;
  /** The step's timing in words, e.g. "2 weeks before the wedding". */
  timing: string;
  flag: ApplyPreviewFlag;
  /** 0 for a top-level step, 1 for a branch child. */
  depth: number;
}

/** The whole preview, as the server action returns it. */
export interface ApplyPreview {
  templateName: string;
  weddingDate: string | null;
  rows: ApplyPreviewRow[];
}

/**
 * Template steps as the apply's undated, pending snapshot rows. Mirrors
 * the row `applyTemplate` inserts; the template ids stand in for the
 * instance ids, which only have to be consistent with `parent_step_id`.
 */
export function draftStepsFromTemplate(source: WorkflowTemplateStepRow[]): WorkflowStepRow[] {
  return source.map((s) => ({
    id: s.id,
    instance_id: 'preview',
    template_step_id: s.id,
    position: s.position,
    type: s.type,
    config: s.config,
    title: s.title,
    description: s.description,
    timing: (s.timing ?? DEFAULT_STEP_TIMING) as StepTiming,
    due_at: null,
    parent_step_id: s.parent_step_id,
    branch_path: s.branch_path,
    status: 'pending',
    requires_approval: s.requires_approval,
    visible_to_couple: s.visible_to_couple,
    approval_token: null,
    approval_expires_at: null,
    completed_at: null,
    error_message: null,
    output: null,
    attempt_count: 0,
    created_at: s.created_at,
    updated_at: s.updated_at,
  }));
}

/**
 * Project an apply without making it.
 *
 * @param drafts - undated, pending steps (see {@link draftStepsFromTemplate})
 * @param anchors - wedding date, apply moment (now) and the MC's timezone
 * @param now - the moment the executor would next look; the apply moment
 * @returns the rows in reading order: each branch's children under it
 */
export function projectApply(
  drafts: WorkflowStepRow[],
  anchors: InstanceAnchors,
  now: Date,
): ApplyPreviewRow[] {
  // Dated exactly as applyTemplate dates its snapshot before settling.
  const patch = new Map(recomputeDueDates(drafts, anchors).map((p) => [p.id, p.due_at]));
  const dated = drafts.map((s) => ({ ...s, due_at: patch.get(s.id) ?? null }));
  const plan = planApplySkips(dated, anchors, now);
  const skipped = new Set(plan.skippedIds);

  const toRow = (step: WorkflowStepRow, depth: number): ApplyPreviewRow => {
    const timing = toStepTiming(step.timing);
    return {
      id: step.id,
      title: stepDisplayTitle(step),
      type: step.type,
      date: step.due_at ? zonedDateParts(new Date(step.due_at), anchors.timezone).date : null,
      timing: describeTiming(timing),
      flag: skipped.has(step.id)
        ? 'skipped_past'
        : timing.mode === 'wedding_relative' && !anchors.weddingDate
          ? 'needs_wedding_date'
          : isAutomated(step.type)
            ? 'scheduled'
            : 'manual',
      depth,
    };
  };

  const byPosition = (a: WorkflowStepRow, b: WorkflowStepRow) => a.position - b.position;
  const rows: ApplyPreviewRow[] = [];
  for (const root of plan.steps.filter((s) => s.parent_step_id === null).sort(byPosition)) {
    rows.push(toRow(root, 0));
    // The "yes" lane reads first, as it does on the canvas.
    for (const lane of ['yes', 'no'] as const) {
      plan.steps
        .filter((s) => s.parent_step_id === root.id && s.branch_path === lane)
        .sort(byPosition)
        .forEach((child) => rows.push(toRow(child, 1)));
    }
  }
  return rows;
}

'use client';

/**
 * Workflow progress for every couple on screen, in one query.
 *
 * The couples board answers "who have I got" but not "where are they up
 * to", which is the question an MC with forty couples actually opens it
 * to answer. A line saying "4 of 12 · next: send the run sheet" turns
 * the board into the overview it looks like it already is.
 *
 * One batched read for the whole page rather than a query per card:
 * forty cards means forty round trips, which is how a board that felt
 * instant starts feeling slow.
 *
 * @module app/(dashboard)/couples/use-workflow-progress
 */

import { useQuery } from '@tanstack/react-query';

import { createClient } from '@/lib/supabase/client';
import { partialSendFailure } from '@/lib/workflows/send-outcome';
import { stepDisplayTitle } from '@/lib/workflows/step-label';
import { isAutomated } from '@/lib/workflows/steps';
import type { StepType } from '@/types/workflows';

/** Where one couple is up to. */
export interface CoupleProgress {
  done: number;
  total: number;
  /** Title of the next thing the MC has to do, or null when nothing waits. */
  nextTitle: string | null;
  /** Something on this couple failed and has not run. */
  hasFailure: boolean;
  /** A message is holding for the MC's OK. */
  needsReview: boolean;
  /**
   * Done sends that reached some recipients and not others. They stay
   * done (re-running would double-send the rest), so without this the
   * board read as a healthy "4 of 4" (Task 31 review M7).
   */
  partialSends: number;
}

/** Rows as PostgREST returns them for the batched read. */
interface ProgressRow {
  title: string;
  type: string;
  /** Read only to name an unnamed step. See {@link stepDisplayTitle}. */
  config?: unknown;
  status: string;
  due_at: string | null;
  requires_approval: boolean;
  /**
   * `output->failed`, the failed-recipient count a send step records.
   * Only that one key is read, not the whole output, which can carry a
   * message id per recipient.
   */
  output_failed?: unknown;
  workflow_instances: { couple_id: string | null } | null;
}

const DONE = new Set(['done', 'skipped']);

/**
 * Progress per couple id.
 *
 * @param coupleIds - the couples currently rendered; the query is skipped when empty
 */
export function useWorkflowProgress(
  coupleIds: string[],
): Map<string, CoupleProgress> {
  // Sorted and joined so a re-render with the same couples in a different
  // order reuses the cached result rather than refetching.
  const key = [...coupleIds].sort().join(',');

  const query = useQuery({
    enabled: coupleIds.length > 0,
    queryKey: ['couple-workflow-progress', key],
    queryFn: async (): Promise<ProgressRow[]> => {
      const supabase = createClient();
      const { data } = await supabase
        .from('workflow_steps')
        .select(
          'title, type, config, status, due_at, requires_approval, output_failed:output->failed, workflow_instances!inner(couple_id)',
        )
        .eq('workflow_instances.status', 'active')
        .in('workflow_instances.couple_id', coupleIds)
        .order('due_at', { ascending: true, nullsFirst: false });
      return (data ?? []) as unknown as ProgressRow[];
    },
  });

  return summarise(query.data ?? []);
}

/**
 * Fold rows into one summary per couple.
 *
 * Exported for the tests: the counting rules are the whole behaviour and
 * they are easier to get wrong than they look. A skipped step counts as
 * done (the MC dealt with it), and the "next" line only ever names
 * something the MC can act on, never an automated step they cannot.
 */
export function summarise(rows: ProgressRow[]): Map<string, CoupleProgress> {
  const out = new Map<string, CoupleProgress>();

  for (const row of rows) {
    const coupleId = row.workflow_instances?.couple_id;
    if (!coupleId) continue;

    const current =
      out.get(coupleId) ??
      { done: 0, total: 0, nextTitle: null, hasFailure: false, needsReview: false, partialSends: 0 };

    // A cancelled step belongs to a stopped workflow: it is neither done
    // nor still to do, so it is left out of both counts. The query reads
    // active instances only, so this is the belt to that brace.
    if (row.status === 'cancelled') continue;

    current.total += 1;
    if (DONE.has(row.status)) current.done += 1;
    if (row.status === 'errored') current.hasFailure = true;
    if (row.status === 'pending' && row.requires_approval) current.needsReview = true;
    // The same rule the couple's Workflows tab uses (`partialSendFailure`).
    if (row.status === 'done' && partialSendFailure({ failed: row.output_failed })) current.partialSends += 1;

    // Rows arrive ordered by due date, so the first pending manual step
    // seen is the next one the MC will actually reach.
    if (
      current.nextTitle === null &&
      row.status === 'pending' &&
      !isAutomated(row.type as StepType)
    ) {
      // Never the raw column: a step the MC did not name stores `''`,
      // and the card would read "next: " with nothing after it.
      current.nextTitle = stepDisplayTitle({ ...row, config: row.config ?? {} });
    }

    out.set(coupleId, current);
  }

  return out;
}

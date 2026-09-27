'use client';

/**
 * The Start preview's body: when each step of a workflow will run for
 * this couple, before anything is applied.
 *
 * The rows come from `previewApplyAction`, which plans with the same
 * rule the apply writes, so a row shown as skipped is a step the apply
 * really skips. The Back and "Start workflow" buttons live in the
 * picker's modal footer.
 *
 * @module app/(dashboard)/couples/workflow-apply-preview
 */

import type { UseQueryResult } from '@tanstack/react-query';

import { Callout } from '@/components/ui/callout';
import { Empty } from '@/components/ui/empty';
import { ErrorState } from '@/components/ui/error-state';
import { Loading } from '@/components/ui/loading';
import type { ApplyPreview } from '@/lib/workflows/apply-projection';

import { WorkflowApplyPreviewRow } from './workflow-apply-preview-row';

/** The line above the list: how many steps the apply will skip. */
export function skippedSummary(count: number): string {
  if (count === 0) return 'Here is when each step will run for this couple.';
  return count === 1
    ? '1 step will be skipped because its date has passed.'
    : `${count} steps will be skipped because their dates have passed.`;
}

export interface WorkflowApplyPreviewProps {
  /** The preview query, owned by the picker so its footer can read it. */
  query: UseQueryResult<ApplyPreview>;
}

/** The preview body. See {@link WorkflowApplyPreviewProps}. */
export function WorkflowApplyPreview({ query }: WorkflowApplyPreviewProps) {
  // isPending, not isLoading: "no data yet" in every case, so an idle
  // or paused fetch shows the spinner rather than an empty error.
  if (query.isPending) return <Loading label="Working out the dates" />;
  if (query.isError) {
    return (
      <ErrorState
        title="Could not preview this workflow"
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const { rows, weddingDate } = query.data;
  if (rows.length === 0) {
    return (
      <Empty
        title="This workflow has no steps yet"
        description="Starting it adds nothing to this couple. Add steps from the Workflows page first."
        size="sm"
      />
    );
  }

  const skipped = rows.filter((r) => r.flag === 'skipped_past').length;
  const waitsForDate = !weddingDate && rows.some((r) => r.flag === 'needs_wedding_date');

  return (
    <div className="flex flex-col gap-3">
      <p className="text-body text-text">{skippedSummary(skipped)}</p>
      {waitsForDate ? (
        <Callout tone="info">
          This couple has no wedding date yet. Steps timed from the wedding will wait until one is
          set.
        </Callout>
      ) : null}
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <WorkflowApplyPreviewRow key={row.id} row={row} />
        ))}
      </ul>
    </div>
  );
}

'use client';

/**
 * A couple's work, as one list.
 *
 * Two sections and a strip: what needs a person now, what is coming,
 * and what is finished. The split, not the workflow each step came
 * from, is what an MC opening a couple actually wants; see
 * {@link bucketCoupleSteps} for why the per-workflow checklists went.
 *
 * @module app/(dashboard)/couples/couple-workflow-list
 */

import { useMemo } from 'react';

import type { RowAction } from '@/components/ui/row-actions-menu';
import { countPartialSends } from '@/lib/workflows/send-outcome';
import type { WorkflowInstanceWithSteps, WorkflowStepRow as StepRow } from '@/types/workflows';

import { CoupleListStrip } from './couple-list-strip';
import { bucketCoupleSteps, type CoupleStepRow } from './couple-workflow-buckets';
import { WorkflowStepRow } from './workflow-step-row';

export interface CoupleWorkflowListProps {
  /** The couple's instances, cancelled ones already dropped. */
  instances: WorkflowInstanceWithSteps[];
  timezone: string;
  /** Renders a step's due date in the MC's words. */
  dueLabel: (step: StepRow) => string;
  onOpen: (stepId: string) => void;
  onTick: (stepId: string) => void;
  onUntick: (stepId: string) => void;
  onSkip: (stepId: string) => void;
  onRetry: (stepId: string) => void;
  onRemove: (stepId: string) => void;
  onReschedule: (stepId: string, dueAt: string | null) => void;
  onRename: (stepId: string, title: string) => void;
  onCancelInstance: (instanceId: string) => void;
  /** Pause a running workflow. Offered beside Stop. */
  onPauseInstance: (instanceId: string) => void;
  /** Ask to resume a paused workflow; the caller confirms first. */
  onResumeInstance: (instanceId: string) => void;
}

/**
 * The workflow-level entries a row's menu gets, after its own. Pause or
 * Resume sits before Stop, the reversible choice ahead of the final one.
 */
function workflowActions(item: CoupleStepRow, props: CoupleWorkflowListProps): RowAction[] {
  const actions: RowAction[] = [];
  if (item.canPause) {
    actions.push({ label: 'Pause this workflow', onSelect: () => props.onPauseInstance(item.instanceId) });
  }
  if (item.canResume) {
    actions.push({ label: 'Resume this workflow', onSelect: () => props.onResumeInstance(item.instanceId) });
  }
  if (item.canStop) {
    actions.push({
      label: 'Stop this workflow',
      destructive: true,
      onSelect: () => props.onCancelInstance(item.instanceId),
    });
  }
  return actions;
}

/** The merged list. See {@link CoupleWorkflowListProps}. */
export function CoupleWorkflowList(props: CoupleWorkflowListProps) {
  const { instances, timezone, onOpen } = props;

  const buckets = useMemo(
    () => bucketCoupleSteps(instances, timezone),
    [instances, timezone],
  );
  // A send that reached only some recipients is done, so it lives in the
  // collapsed Done strip; its header says so, so the MC sees it without
  // opening it (review I1). Not moved into "Needs you now": Try again
  // would re-send to the recipients who already got it.
  const partialCount = countPartialSends(buckets.done.map((item) => item.step));
  const partialLabel = partialCount > 0 ? `${partialCount} partly failed` : null;

  /** One row, wired to every mutation the tab offers. */
  function row(item: CoupleStepRow) {
    return (
      <WorkflowStepRow
        key={item.step.id}
        step={item.step}
        dueLabel={props.dueLabel(item.step)}
        workflowName={item.workflowName}
        paused={item.paused}
        onOpen={onOpen}
        onTick={props.onTick}
        onUntick={props.onUntick}
        onSkip={props.onSkip}
        onRetry={props.onRetry}
        onRemove={props.onRemove}
        onReschedule={props.onReschedule}
        onRename={props.onRename}
        extraActions={workflowActions(item, props)}
      />
    );
  }

  if (
    buckets.needsYouNow.length === 0 &&
    buckets.next.length === 0 &&
    buckets.done.length === 0
  ) {
    return (
      <p className="text-body text-text-muted">
        Nothing on this couple yet. Start a workflow, or add a to-do.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {buckets.needsYouNow.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-section text-text">Needs you now</h3>
          <div className="overflow-hidden rounded-control border border-border">
            {buckets.needsYouNow.map(row)}
          </div>
        </section>
      ) : null}

      {buckets.next.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-section text-text">Next</h3>
          <div className="overflow-hidden rounded-control border border-border">
            {buckets.next.map(row)}
          </div>
        </section>
      ) : null}

      {/* Finished work belongs at the end of the list it came from, and
          collapsed: it is the answer to "what did I already do", not
          something the MC is working through. */}
      {buckets.done.length > 0 ? (
        <CoupleListStrip label="Done" count={buckets.done.length} warning={partialLabel}>
          {buckets.done.map(row)}
        </CoupleListStrip>
      ) : null}
    </div>
  );
}

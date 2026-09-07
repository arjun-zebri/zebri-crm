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

import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { WorkflowInstanceWithSteps, WorkflowStepRow as StepRow } from '@/types/workflows';

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
}

/** The merged list. See {@link CoupleWorkflowListProps}. */
export function CoupleWorkflowList(props: CoupleWorkflowListProps) {
  const { instances, timezone, onOpen, onCancelInstance } = props;
  const [doneOpen, setDoneOpen] = useState(false);

  const buckets = useMemo(
    () => bucketCoupleSteps(instances, timezone),
    [instances, timezone],
  );

  /** One row, wired to every mutation the tab offers. */
  function row(item: CoupleStepRow) {
    return (
      <WorkflowStepRow
        key={item.step.id}
        step={item.step}
        dueLabel={props.dueLabel(item.step)}
        workflowName={item.workflowName}
        onOpen={onOpen}
        onTick={props.onTick}
        onUntick={props.onUntick}
        onSkip={props.onSkip}
        onRetry={props.onRetry}
        onRemove={props.onRemove}
        onReschedule={props.onReschedule}
        onRename={props.onRename}
        extraActions={
          item.canStop
            ? [
                {
                  label: 'Stop this workflow',
                  destructive: true,
                  onSelect: () => onCancelInstance(item.instanceId),
                },
              ]
            : []
        }
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
        <div className="border-t border-border">
          <button
            type="button"
            onClick={() => setDoneOpen((wasOpen) => !wasOpen)}
            aria-expanded={doneOpen}
            className="flex w-full cursor-pointer items-center gap-2 py-3 text-body text-text-muted hover:text-text"
          >
            <ChevronRight
              size={16}
              strokeWidth={1.5}
              className={`transition-transform ${doneOpen ? 'rotate-90' : ''}`}
            />
            Done ({buckets.done.length})
          </button>
          {doneOpen ? (
            <div className="overflow-hidden rounded-control border border-border">
              {buckets.done.map(row)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

'use client';

/**
 * The body of the couple's Workflow tab: the working list, the stopped
 * strip under it, and the Resume confirm both of them open.
 *
 * Split from `couple-workflow.tsx` so the tab stays an orchestrator. The
 * list gets the running and paused workflows; stopped ones are kept out
 * of it (they are not work) and listed in their own strip instead.
 *
 * @module app/(dashboard)/couples/couple-workflow-work
 */

import { useMemo } from 'react';

import type { WorkflowInstanceWithSteps, WorkflowStepRow } from '@/types/workflows';

import { CoupleStoppedWorkflows } from './couple-stopped-workflows';
import { CoupleWorkflowList } from './couple-workflow-list';
import type { CoupleWorkflows } from './use-couple-workflows';
import { useInstanceControls } from './use-instance-controls';
import { WorkflowResumeDialog } from './workflow-resume-dialog';

export interface CoupleWorkflowWorkProps {
  coupleId: string;
  /** Every instance on the couple, stopped ones included. */
  instances: WorkflowInstanceWithSteps[];
  timezone: string;
  /** Renders a step's due date in the MC's words. */
  dueLabel: (step: WorkflowStepRow) => string;
  onOpen: (stepId: string) => void;
  /** The step mutations the list offers. */
  workflows: CoupleWorkflows;
}

/** See {@link CoupleWorkflowWorkProps}. */
export function CoupleWorkflowWork({
  coupleId,
  instances,
  timezone,
  dueLabel,
  onOpen,
  workflows,
}: CoupleWorkflowWorkProps) {
  const controls = useInstanceControls(coupleId);

  const visible = useMemo(() => instances.filter((i) => i.status !== 'cancelled'), [instances]);
  const stopped = useMemo(
    () =>
      instances
        // The couple's own to-do list is never stopped as a workflow; if
        // an old one was, it is not something to resume from here.
        .filter((i) => i.status === 'cancelled' && !i.is_default && !i.is_personal)
        .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')),
    [instances],
  );

  /** Resume from the list: only paused rows offer it. */
  function resumeFromList(instanceId: string) {
    const instance = visible.find((i) => i.id === instanceId);
    if (instance) controls.requestResume({ instanceId, name: instance.name, from: 'paused' });
  }

  return (
    <div className="space-y-6">
      <CoupleWorkflowList
        instances={visible}
        timezone={timezone}
        dueLabel={dueLabel}
        onOpen={onOpen}
        onTick={workflows.tick}
        onUntick={workflows.untick}
        onSkip={workflows.skip}
        onRetry={workflows.retry}
        onRemove={workflows.removeStep}
        onReschedule={workflows.reschedule}
        onRename={workflows.rename}
        onCancelInstance={workflows.cancelInstance}
        onPauseInstance={controls.pause}
        onResumeInstance={resumeFromList}
      />

      <CoupleStoppedWorkflows
        instances={stopped}
        all={instances}
        timezone={timezone}
        onResume={(instance) =>
          controls.requestResume({ instanceId: instance.id, name: instance.name, from: 'cancelled' })
        }
      />

      <WorkflowResumeDialog
        target={controls.resumeTarget}
        loading={controls.resuming}
        onConfirm={controls.confirmResume}
        onCancel={controls.cancelResume}
      />
    </div>
  );
}

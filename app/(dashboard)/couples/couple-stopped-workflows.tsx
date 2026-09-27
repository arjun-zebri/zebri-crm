'use client';

/**
 * The workflows stopped on this couple, as a collapsed strip.
 *
 * Stopping used to make a workflow vanish from the tab: the list drops
 * cancelled instances, so the only way back was to start it again from
 * scratch, re-sending whatever it had already sent. Each one is listed
 * here with why it stopped, and Resume where the server allows it
 * (`resumeRefusal`). Where it does not, the reason stands in for the
 * button, so the MC is never offered something that will be refused.
 *
 * @module app/(dashboard)/couples/couple-stopped-workflows
 */

import { Button } from '@/components/ui/button';
import { zonedDateParts } from '@/lib/scheduling/timezone';
import { hasLiveTwin, resumeRefusal } from '@/lib/workflows/resume-eligibility';
import type { CancelledReason, WorkflowInstanceWithSteps } from '@/types/workflows';

import { CoupleListStrip } from './couple-list-strip';

/** How each recorded reason reads on the row. */
const STOPPED_BY: Record<CancelledReason, string> = {
  manual: 'You stopped it',
  template_deleted: 'Its workflow was deleted',
  setup_interrupted: 'Its setup did not finish',
  exit_rule: 'An exit rule ended it',
};

export interface CoupleStoppedWorkflowsProps {
  /** The couple's cancelled instances, most recently stopped first. */
  instances: WorkflowInstanceWithSteps[];
  /** Every instance on the couple, to spot one started again. */
  all: WorkflowInstanceWithSteps[];
  timezone: string;
  onResume: (instance: WorkflowInstanceWithSteps) => void;
}

/** One line on why and when it stopped. Old stops carry no reason. */
function stoppedLine(instance: WorkflowInstanceWithSteps, timezone: string): string {
  const who = instance.cancelled_reason ? STOPPED_BY[instance.cancelled_reason] : 'Stopped';
  if (!instance.completed_at) return who;
  return `${who} on ${zonedDateParts(new Date(instance.completed_at), timezone).date}`;
}

/** See {@link CoupleStoppedWorkflowsProps}. Renders nothing when none stopped. */
export function CoupleStoppedWorkflows({
  instances,
  all,
  timezone,
  onResume,
}: CoupleStoppedWorkflowsProps) {
  if (instances.length === 0) return null;
  return (
    <CoupleListStrip label="Stopped" count={instances.length}>
      {instances.map((instance) => {
        const refusal = resumeRefusal(instance);
        // Started again since: the server would refuse the resume (the
        // dedupe index), so say so instead of offering it.
        const runningAgain = refusal === null && hasLiveTwin(instance, all);
        return (
          <div
            key={instance.id}
            className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <span className="block truncate text-body text-text">{instance.name}</span>
              <span className="block text-body text-text-muted">
                {refusal ?? stoppedLine(instance, timezone)}
              </span>
            </div>
            {runningAgain ? (
              <span className="shrink-0 text-body text-text-muted">Running again</span>
            ) : refusal ? null : (
              <Button
                variant="outline"
                className="shrink-0"
                aria-label={`Resume ${instance.name}`}
                onClick={() => onResume(instance)}
              >
                Resume
              </Button>
            )}
          </div>
        );
      })}
    </CoupleListStrip>
  );
}

'use client';

/**
 * The leading mark of a workflow step row: a status glyph for an
 * automated step, a checkbox for a manual one.
 *
 * Split out of `./workflow-step-row` (Phase 5 fix wave, parked size item)
 * so the row stays a layout of its parts.
 *
 * @module app/(dashboard)/couples/workflow-step-glyph
 */

import { AlertTriangle, Check, GitBranch, Timer, Zap } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import type { PartialSendFailure } from '@/lib/workflows/send-outcome';
import { isAutomated } from '@/lib/workflows/steps';
import type { WorkflowStepRow as StepRow } from '@/types/workflows';

/** Icon for an automated step, by type. */
const AUTOMATED_ICON = {
  action: Zap,
  wait: Timer,
  branch: GitBranch,
} as const;

export interface WorkflowStepGlyphProps {
  step: StepRow;
  /** The partial-send warning, when a done send missed someone. */
  partial: PartialSendFailure | null;
  onTick: (stepId: string) => void;
  onUntick: (stepId: string) => void;
}

/** The glyph or checkbox. See {@link WorkflowStepGlyphProps}. */
export function WorkflowStepGlyph({ step, partial, onTick, onUntick }: WorkflowStepGlyphProps) {
  const done = step.status === 'done';
  if (!isAutomated(step.type)) {
    return (
      // Ticking acts on the row; it must not also open the step.
      <span className="shrink-0" onClick={(event) => event.stopPropagation()}>
        <Checkbox
          checked={done}
          onChange={() => (done ? onUntick(step.id) : onTick(step.id))}
          ariaLabel={`Mark "${step.title}" ${done ? 'not done' : 'done'}`}
        />
      </span>
    );
  }
  const AutomatedIcon = AUTOMATED_ICON[step.type as keyof typeof AUTOMATED_ICON] ?? Zap;
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
      {step.status === 'errored' ? (
        <AlertTriangle size={16} strokeWidth={1.5} className="text-danger" aria-label="This step failed" />
      ) : partial ? (
        // A send that reached only some recipients is done, but must not
        // wear the plain green tick (audit M6).
        <AlertTriangle size={16} strokeWidth={1.5} className="text-warning" aria-label="Sent, but not to everyone" />
      ) : done ? (
        <Check size={16} strokeWidth={1.5} className="text-success" aria-label="Done" />
      ) : (
        <AutomatedIcon size={16} strokeWidth={1.5} className="text-text-subtle" aria-label="Runs automatically" />
      )}
    </span>
  );
}

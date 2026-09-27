'use client';

/**
 * The middle of a workflow step row: its title (renamed in place), the
 * pills that say whose move it is, the workflow it came from, and the
 * line under it (why it failed, who a send missed, or which branch).
 *
 * Split out of `./workflow-step-row` (Phase 5 fix wave, parked size item).
 *
 * @module app/(dashboard)/couples/workflow-step-title
 */

import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { StatePill } from '@/components/ui/state-pill';
import { partialSendFailureLabel, type PartialSendFailure } from '@/lib/workflows/send-outcome';
import type { WorkflowStepRow as StepRow } from '@/types/workflows';

export interface WorkflowStepTitleProps {
  step: StepRow;
  partial: PartialSendFailure | null;
  /** The title is being renamed in place. */
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onRename: (stepId: string, title: string) => void;
  workflowName: string | null;
  paused: boolean;
}

/** The title block. See {@link WorkflowStepTitleProps}. */
export function WorkflowStepTitle({
  step,
  partial,
  editing,
  onEditingChange,
  onRename,
  workflowName,
  paused,
}: WorkflowStepTitleProps) {
  const [draft, setDraft] = useState(step.title);
  const done = step.status === 'done';
  const skipped = step.status === 'skipped';
  const cancelled = step.status === 'cancelled';

  return (
    <div className="min-w-0 flex-1" onClick={editing ? (event) => event.stopPropagation() : undefined}>
      {editing ? (
        <Input
          autoFocus
          value={draft}
          aria-label="Step name"
          onChange={(e) => setDraft(e.currentTarget.value)}
          onBlur={() => {
            onEditingChange(false);
            const next = draft.trim();
            if (next.length > 0 && next !== step.title) onRename(step.id, next);
            else setDraft(step.title);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              setDraft(step.title);
              onEditingChange(false);
            }
          }}
        />
      ) : (
        // Wraps below `sm`: the title keeps its line and the pills drop
        // under it. On one line at 390px the "Needs your OK" pill and the
        // due date left the title 19px, so it read "V…" (live check B6).
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:flex-nowrap">
          <span
            className={`min-w-0 max-w-full truncate text-body ${
              // A partly failed send is done but not finished with, so
              // it is not struck through beside its warning triangle.
              (done && !partial) || skipped ? 'text-text-subtle line-through' : 'text-text'
            }`}
          >
            {step.title || 'Untitled step'}
          </span>
          {/* Whose move it is, before whose workflow it came from. */}
          {step.requires_approval && step.status === 'pending' ? (
            <StatePill label="Needs your OK" tone="warning" dot="hollow" className="shrink-0" />
          ) : null}
          {cancelled ? <StatePill label="Cancelled" tone="neutral" className="shrink-0" /> : null}
          {paused && !done && !skipped && !cancelled ? (
            <StatePill label="Paused" tone="neutral" className="shrink-0" />
          ) : null}
          {/* On a phone the title wins the row: held at full width, a
              long workflow name squeezed the title to nothing and ran
              into the due label. Wider screens show it, truncating. */}
          {workflowName ? (
            <span className="hidden min-w-0 truncate rounded-pill sm:inline bg-surface-muted px-2 text-body text-text-muted">
              {workflowName}
            </span>
          ) : null}
        </span>
      )}
      {step.status === 'errored' && step.error_message ? (
        <span className="block truncate text-body text-danger">{step.error_message}</span>
      ) : partial ? (
        <span className="block truncate text-body text-text-muted">
          {partialSendFailureLabel(partial)}
          {partial.reason ? `: ${partial.reason}` : ''}
        </span>
      ) : step.branch_path ? (
        <span className="block text-body text-text-muted">{step.branch_path === 'yes' ? 'If yes' : 'If no'}</span>
      ) : null}
    </div>
  );
}

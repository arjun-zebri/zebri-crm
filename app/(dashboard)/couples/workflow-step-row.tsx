'use client';

/**
 * One step in a couple's workflow checklist.
 *
 * A checkbox for manual steps, a status glyph for automated ones, the
 * title, its due date and an overflow menu (the glyph and the title
 * block live in `./workflow-step-glyph` and `./workflow-step-title`).
 * Branch children render
 * indented under their branch step, which is where the vertical list
 * from the spec actually lives: the builder stays a canvas, the applied
 * instance reads as a checklist.
 *
 * @module app/(dashboard)/couples/workflow-step-row
 */

import { CalendarClock } from 'lucide-react';
import { useState } from 'react';

import { RowActionsMenu, type RowAction } from '@/components/ui/row-actions-menu';
import { partialSendFailure } from '@/lib/workflows/send-outcome';
import type { WorkflowStepRow as StepRow } from '@/types/workflows';

import { workflowStepActions } from './workflow-step-actions';
import { WorkflowStepGlyph } from './workflow-step-glyph';
import { WorkflowStepTitle } from './workflow-step-title';

export interface WorkflowStepRowProps {
  step: StepRow;
  /** Human due label, e.g. "3 days ago". Empty string renders nothing. */
  dueLabel: string;
  /** Nesting depth: branch children render one level in. */
  depth?: number;
  onTick: (stepId: string) => void;
  onUntick: (stepId: string) => void;
  onSkip: (stepId: string) => void;
  onRetry: (stepId: string) => void;
  onRemove: (stepId: string) => void;
  onReschedule: (stepId: string, dueAt: string | null) => void;
  onRename: (stepId: string, title: string) => void;
  /** Opens the step. Given it, the whole row is the click target. */
  onOpen?: (stepId: string) => void;
  /**
   * The workflow this step belongs to, as a chip beside the title.
   *
   * Null for a loose to-do: the couple's own list is not a workflow the
   * MC started, so naming it would invent a thing they never made.
   */
  workflowName?: string | null;
  /** The step's workflow is paused, so it will not run until resumed. */
  paused?: boolean;
  /** Appended to the row menu, e.g. "Stop this workflow". */
  extraActions?: RowAction[];
}

/** A single checklist row. See {@link WorkflowStepRowProps}. */
export function WorkflowStepRow({
  step,
  dueLabel,
  depth = 0,
  onTick,
  onUntick,
  onSkip,
  onRetry,
  onRemove,
  onReschedule,
  onRename,
  onOpen,
  workflowName = null,
  paused = false,
  extraActions = [],
}: WorkflowStepRowProps) {
  const [editing, setEditing] = useState(false);
  const done = step.status === 'done';
  // A send that reached only some recipients is done, but must not wear
  // the plain green tick (audit M6). Derived from the step's output.
  const partial = done ? partialSendFailure(step.output) : null;

  return (
    // The whole row opens the step when the surface offers a detail
    // view. Everything that acts on the row rather than opening it
    // swallows the click.
    <div
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen ? () => onOpen(step.id) : undefined}
      onKeyDown={
        onOpen
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpen(step.id);
              }
            }
          : undefined
      }
      className={`group flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 ${
        onOpen ? 'cursor-pointer hover:bg-surface-muted' : ''
      }`}
    >
      {/* Indent branch children rather than nesting a bordered box. */}
      {depth > 0 ? <span className="w-6 shrink-0" aria-hidden /> : null}

      <WorkflowStepGlyph step={step} partial={partial} onTick={onTick} onUntick={onUntick} />

      <WorkflowStepTitle
        step={step}
        partial={partial}
        editing={editing}
        onEditingChange={setEditing}
        onRename={onRename}
        workflowName={workflowName}
        paused={paused}
      />

      {step.type === 'appointment' ? (
        <CalendarClock
          size={16}
          strokeWidth={1.5}
          className="shrink-0 text-text-subtle"
          aria-label="Appointment"
        />
      ) : null}

      <span className="shrink-0 text-body text-text-muted">{dueLabel}</span>

      <RowActionsMenu
        size="sm"
        actions={workflowStepActions(
          step,
          { onRetry, onRename: () => setEditing(true), onReschedule, onSkip, onUntick, onRemove },
          extraActions,
        )}
      />
    </div>
  );
}

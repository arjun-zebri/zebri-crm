'use client';

/**
 * One step in a couple's workflow checklist.
 *
 * A checkbox for manual steps, a status glyph for automated ones, the
 * title, its due date and an overflow menu. Branch children render
 * indented under their branch step, which is where the vertical list
 * from the spec actually lives: the builder stays a canvas, the applied
 * instance reads as a checklist.
 *
 * @module app/(dashboard)/couples/workflow-step-row
 */

import {
  AlertTriangle,
  CalendarClock,
  Check,
  GitBranch,
  Timer,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

import { inDays } from '@/app/(dashboard)/workflows/queue-labels';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { RowActionsMenu, type RowAction } from '@/components/ui/row-actions-menu';
import { StatePill } from '@/components/ui/state-pill';
import { isAutomated } from '@/lib/workflows/steps';
import type { WorkflowStepRow as StepRow } from '@/types/workflows';

/** Icon for an automated step, by type. */
const AUTOMATED_ICON = {
  action: Zap,
  wait: Timer,
  branch: GitBranch,
} as const;

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
  extraActions = [],
}: WorkflowStepRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(step.title);
  const done = step.status === 'done';
  const skipped = step.status === 'skipped';
  const errored = step.status === 'errored';
  const automated = isAutomated(step.type);
  const AutomatedIcon =
    AUTOMATED_ICON[step.type as keyof typeof AUTOMATED_ICON] ?? Zap;

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

      {automated ? (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {errored ? (
            <AlertTriangle
              size={16}
              strokeWidth={1.5}
              className="text-danger"
              aria-label="This step failed"
            />
          ) : done ? (
            <Check size={16} strokeWidth={1.5} className="text-success" aria-label="Done" />
          ) : (
            <AutomatedIcon
              size={16}
              strokeWidth={1.5}
              className="text-text-subtle"
              aria-label="Runs automatically"
            />
          )}
        </span>
      ) : (
        <span className="shrink-0" onClick={(event) => event.stopPropagation()}>
          <Checkbox
            checked={done}
            onChange={() => (done ? onUntick(step.id) : onTick(step.id))}
            ariaLabel={`Mark "${step.title}" ${done ? 'not done' : 'done'}`}
          />
        </span>
      )}

      <div className="min-w-0 flex-1" onClick={editing ? (event) => event.stopPropagation() : undefined}>
        {editing ? (
          <Input
            autoFocus
            value={draft}
            aria-label="Step name"
            onChange={(e) => setDraft(e.currentTarget.value)}
            onBlur={() => {
              setEditing(false);
              const next = draft.trim();
              if (next.length > 0 && next !== step.title) onRename(step.id, next);
              else setDraft(step.title);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                setDraft(step.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={`min-w-0 truncate text-body ${
                done || skipped ? 'text-text-subtle line-through' : 'text-text'
              }`}
            >
              {step.title || 'Untitled step'}
            </span>
            {/* Whose move it is, before whose workflow it came from. */}
            {step.requires_approval && step.status === 'pending' ? (
              <StatePill
                label="Needs your OK"
                tone="warning"
                dot="hollow"
                className="shrink-0"
              />
            ) : null}
            {workflowName ? (
              <span className="shrink-0 rounded-pill bg-surface-muted px-2 text-body text-text-muted">
                {workflowName}
              </span>
            ) : null}
          </span>
        )}
        {errored && step.error_message ? (
          <span className="block truncate text-body text-danger">{step.error_message}</span>
        ) : step.branch_path ? (
          <span className="block text-body text-text-muted">
            {step.branch_path === 'yes' ? 'If yes' : 'If no'}
          </span>
        ) : null}
      </div>

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
        actions={[
          ...(errored
            ? [{ label: 'Try again', onSelect: () => onRetry(step.id) }]
            : []),
          ...(!done && !skipped
            ? [
                { label: 'Rename', onSelect: () => setEditing(true) },
                { label: 'Tomorrow', onSelect: () => onReschedule(step.id, inDays(1)) },
                { label: 'Next week', onSelect: () => onReschedule(step.id, inDays(7)) },
                { label: 'Take the date off', onSelect: () => onReschedule(step.id, null) },
                { label: 'Skip this step', onSelect: () => onSkip(step.id) },
              ]
            : []),
          ...(done || skipped
            ? [{ label: 'Reopen', onSelect: () => onUntick(step.id) }]
            : []),
          { label: 'Remove', destructive: true, onSelect: () => onRemove(step.id) },
          ...extraActions,
        ]}
      />
    </div>
  );
}

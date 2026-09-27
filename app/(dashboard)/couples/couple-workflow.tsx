'use client';

/**
 * The couple profile's Workflow tab.
 *
 * Folds what used to be two tabs into one: the applied workflows as
 * checklists (formerly Tasks) and the engine's audit feed (formerly
 * Automations). Orchestrator only. Everything it renders lives in a
 * sibling component, and every mutation goes through
 * {@link useCoupleWorkflows}.
 *
 * @module app/(dashboard)/couples/couple-workflow
 */

import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { StepDetailModal } from '@/app/(dashboard)/workflows/step-detail-modal';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState } from '@/components/ui/error-state';
import { Loading } from '@/components/ui/loading';
import { zonedDateParts } from '@/lib/scheduling/timezone';
import { detectNudges } from '@/lib/workflows/nudges';
import { toStepTiming } from '@/lib/workflows/timing-summary';
import type { WorkflowStepRow } from '@/types/workflows';

import { coupleDueLabel } from './couple-due-label';
import { CoupleTabShell, type TabStat } from './couple-tab-shell';
import { CoupleTodoModal } from './couple-todo-modal';
import { workflowTabStats } from './couple-workflow-stats';
import { CoupleWorkflowWork } from './couple-workflow-work';
import { useCoupleWorkflows } from './use-couple-workflows';
import { useUserTimezone } from './use-user-timezone';
import { WorkflowActivity } from './workflow-activity';
import { WorkflowApplyPicker } from './workflow-apply-picker';
import { WorkflowNudges } from './workflow-nudges';

/**
 * Nudges the list itself already makes, so the banner does not.
 *
 * "Needs you now" is exactly these three: held sends, failures and
 * anything overdue, named row by row in the place the MC acts on them.
 * A banner counting the same rows above them is the page saying it
 * twice. The digest keeps its own copy.
 */
const COVERED_BY_THE_LIST = new Set(['review', 'errored', 'overdue']);

export interface CoupleWorkflowProps {
  coupleId: string;
  /** The couple's wedding date, for the "wedding is close" nudge. */
  weddingDate?: string | null;
}

/** The Workflow tab. See {@link CoupleWorkflowProps}. */
export function CoupleWorkflow({ coupleId, weddingDate = null }: CoupleWorkflowProps) {
  const workflows = useCoupleWorkflows(coupleId);
  const timezone = useUserTimezone();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [todoOpen, setTodoOpen] = useState(false);
  const [openStepId, setOpenStepId] = useState<string | null>(null);
  const [confirmStopAll, setConfirmStopAll] = useState(false);

  const visible = useMemo(
    // A cancelled workflow stays in the data so the audit trail makes
    // sense, but it is not something the MC is working through.
    () => workflows.instances.filter((i) => i.status !== 'cancelled'),
    [workflows.instances],
  );

  const appliedTemplateIds = useMemo(
    () =>
      workflows.instances
        // Paused counts as applied: it still holds the couple's
        // enrolment, and the database refuses a second one.
        .filter(
          (i) => (i.status === 'active' || i.status === 'paused') && i.template_id !== null,
        )
        .map((i) => i.template_id as string),
    [workflows.instances],
  );

  const stats = useMemo<TabStat[] | undefined>(
    () => workflowTabStats(visible.flatMap((i) => i.steps), timezone),
    [visible, timezone],
  );

  const nudges = useMemo(() => {
    if (workflows.isLoading) return [];
    const steps = visible.flatMap((i) => i.steps);
    return detectNudges({
      weddingDate,
      todayLocal: zonedDateParts(new Date(), timezone).date,
      hasActiveWorkflow: visible.some((i) => !i.is_default && i.status === 'active'),
      steps: steps.map((s) => ({
        title: s.title,
        type: s.type,
        status: s.status,
        dueAt: s.due_at,
        requiresApproval: s.requires_approval,
        timing: toStepTiming(s.timing),
      })),
    }).filter((nudge) => !COVERED_BY_THE_LIST.has(nudge.id));
  }, [visible, timezone, weddingDate, workflows.isLoading]);

  // "Stop everything" ends paused workflows too, so they count here.
  const runningCount = visible.filter(
    (i) => !i.is_default && (i.status === 'active' || i.status === 'paused'),
  ).length;

  // A fragment, not a row of its own: the tab shell lays the actions out,
  // and wraps them onto a second line at phone width (live check B3).
  const actions = (
    <>
      {runningCount > 0 ? (
        <Button variant="ghost" onClick={() => setConfirmStopAll(true)}>
          Stop everything
        </Button>
      ) : null}
      <Button variant="outline" onClick={() => setPickerOpen(true)}>
        <Plus size={16} strokeWidth={1.5} />
        Start a workflow
      </Button>
      {/* Ad-hoc work sits beside the workflows because it is the same
          thing to the MC: something on this couple that has to happen. */}
      <Button variant="outline" onClick={() => setTodoOpen(true)}>
        <Plus size={16} strokeWidth={1.5} />
        Add a to-do
      </Button>
    </>
  );

  return (
    <CoupleTabShell title="Workflow" stats={stats} actions={actions}>
      {workflows.isLoading ? (
        <Loading label="Loading workflow" />
      ) : workflows.error ? (
        <ErrorState
          title="Could not load this couple's workflow"
          error={workflows.error}
          onRetry={workflows.refetch}
        />
      ) : (
        <div className="space-y-6">
          <WorkflowNudges nudges={nudges} />

          {/* The list, the stopped strip, and Pause / Resume. */}
          <CoupleWorkflowWork
            coupleId={coupleId}
            instances={workflows.instances}
            timezone={timezone}
            dueLabel={(step: WorkflowStepRow) => coupleDueLabel(step, timezone)}
            onOpen={setOpenStepId}
            workflows={workflows}
          />

          <WorkflowActivity coupleId={coupleId} />
        </div>
      )}

      <CoupleTodoModal
        isOpen={todoOpen}
        onClose={() => setTodoOpen(false)}
        onAdd={(input) => workflows.addStep(input)}
      />

      <StepDetailModal
        stepId={openStepId}
        onClose={() => setOpenStepId(null)}
        onSettled={workflows.refetch}
      />

      <WorkflowApplyPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        coupleId={coupleId}
        appliedTemplateIds={appliedTemplateIds}
        onApply={workflows.applyTemplate}
      />

      <ConfirmDialog
        open={confirmStopAll}
        onCancel={() => setConfirmStopAll(false)}
        onConfirm={() => {
          workflows.cancelAll();
          setConfirmStopAll(false);
        }}
        title="Stop every workflow on this couple?"
        description="Nothing further sends or comes due for them. What has already happened stays in the activity feed, and their to-do list is untouched."
        confirmLabel="Stop everything"
      />
    </CoupleTabShell>
  );
}

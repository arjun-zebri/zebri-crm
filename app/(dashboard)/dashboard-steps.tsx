'use client';

/**
 * Dashboard card: the manual steps the MC still owes, across every couple.
 *
 * Replaces the old Outstanding Tasks card. A to-do is now a step on a
 * couple's workflow, so this reads the same rows the Workflows queue
 * does; clicking one opens that couple's Workflow tab.
 *
 * @module app/(dashboard)/dashboard-steps
 */

import { Card } from '@/components/ui/card';
import { formatRelativeDate, isPastDue } from '@/lib/utils';

import type { DashboardStep } from './use-dashboard';

export interface DashboardStepsProps {
  steps: DashboardStep[];
  isLoading: boolean;
  onCoupleClick: (couple: { id: string; name: string }) => void;
}

const HEADING = 'Outstanding To-Dos';

/**
 * A step's due moment as the calendar day the MC would call it.
 *
 * `formatRelativeDate` and `isPastDue` both take a **date-only** string:
 * they append `T00:00:00` to it. That was right for the old `tasks.due_date`
 * (a `date`), but `workflow_steps.due_at` is a `timestamptz`, and appending
 * to a full ISO timestamp produced `Invalid Date` on every row. `en-CA`
 * renders `YYYY-MM-DD`, in the viewer's own timezone, which is the day they
 * mean when they say a to-do is due today.
 */
function localDay(dueAt: string): string {
  return new Date(dueAt).toLocaleDateString('en-CA');
}

/** The card's title, shared by all three states so they line up. */
function Heading() {
  return (
    <h2 className="text-section font-semibold text-text mb-4 shrink-0">{HEADING}</h2>
  );
}

/** Outstanding manual steps. See {@link DashboardStepsProps}. */
export function DashboardSteps({ steps, isLoading, onCoupleClick }: DashboardStepsProps) {
  if (isLoading) {
    return (
      <Card>
        <Heading />
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse flex items-center gap-2 py-2">
              <div className="flex-1 min-w-0">
                <div className="h-3.5 bg-surface-emphasis rounded-control w-40 mb-1.5" />
                <div className="h-3 bg-surface-emphasis rounded-control w-24" />
              </div>
              <div className="h-3 bg-surface-emphasis rounded-control w-12 shrink-0" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (steps.length === 0) {
    return (
      <Card>
        <Heading />
        <div className="text-center py-12">
          <p className="text-text-muted text-body">All caught up.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col">
      <Heading />
      <div className="space-y-1 flex-1 max-h-60 overflow-y-auto scrollbar-hover pr-1">
        {steps.map((step) => {
          const day = step.due_at ? localDay(step.due_at) : null;
          const overdue = isPastDue(day);
          return (
            <div
              key={step.id}
              role="link"
              tabIndex={0}
              onClick={() => {
                if (step.couple) onCoupleClick(step.couple);
              }}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && step.couple) {
                  e.preventDefault();
                  onCoupleClick(step.couple);
                }
              }}
              className="flex items-center gap-2 py-2 transition cursor-pointer group"
            >
              <div className="flex-1 min-w-0">
                <span className="truncate block text-body text-text transition-opacity group-hover:opacity-80">
                  {step.title}
                </span>
                {step.couple && (
                  <span className="text-text-subtle text-body truncate block">
                    {step.couple.name}
                  </span>
                )}
              </div>
              {day && (
                <span
                  className={`text-body shrink-0 ${overdue ? 'text-danger font-medium' : 'text-text-muted'}`}
                >
                  {formatRelativeDate(day)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

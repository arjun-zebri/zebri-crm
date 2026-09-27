'use client';

/**
 * The warning on a workflow that is on while some of its steps are not
 * finished (Task 34).
 *
 * Turn on refuses an unfinished workflow, but a workflow already on can
 * still gain one: a step added from the picker is a placeholder until it
 * is filled in, and the save-time check lets that through (Task 33). A
 * couple enrolled meanwhile reaches it and errors, so the canvas says
 * which steps, above the flow, until they are finished.
 *
 * @module app/(dashboard)/workflows/[id]/unfinished-steps-banner
 */

import { Callout } from '@/components/ui/callout';
import type { PreflightProblem } from '@/lib/workflows/preflight';

interface Props {
  /** The template's status; only `active` can warn. */
  status: string;
  /** The pre-flight's rows, or null before it has answered. */
  problems: readonly PreflightProblem[] | null;
}

/** "Send email", "Send email and Branch", "A, B and C". */
function names(rows: readonly PreflightProblem[]): string {
  const all = rows.map((p) => p.title);
  return all.length <= 1 ? (all[0] ?? '') : `${all.slice(0, -1).join(', ')} and ${all[all.length - 1]}`;
}

/**
 * The warning, worded by what actually happens: a bad config or a step
 * the engine cannot run errors for the couple, while an unnamed to-do or
 * appointment runs and simply says nothing. Claiming every one errors
 * would send the MC looking for failures that are not there.
 */
function warning(problems: readonly PreflightProblem[]): string {
  if (problems.some((p) => p.kind === 'empty')) {
    return 'This workflow is on, but it has no steps yet. Add one, or turn it off.';
  }
  const n = problems.length;
  const erroring = problems.filter((p) => p.kind !== 'unnamed');
  const unnamed = problems.filter((p) => p.kind === 'unnamed');
  const parts = [`This workflow is on, but ${n === 1 ? '1 step is' : `${n} steps are`} unfinished.`];
  if (erroring.length > 0) {
    const them = erroring.length === 1 ? 'it' : 'them';
    parts.push(`${names(erroring)} will error for a couple who reaches ${them}.`);
  }
  if (unnamed.length > 0) {
    parts.push(
      unnamed.length === 1
        ? `${names(unnamed)} has no name, so it won't say what to do.`
        : `${names(unnamed)} have no name, so they won't say what to do.`,
    );
  }
  parts.push(`Finish ${n === 1 ? 'it' : 'them'}, or turn it off.`);
  return parts.join(' ');
}

/** Renders nothing unless the workflow is on and something is unfinished. */
export function UnfinishedStepsBanner({ status, problems }: Props) {
  if (status !== 'active' || !problems || problems.length === 0) return null;
  return (
    <div className="px-4 pt-3 sm:px-6">
      <Callout tone="warning">{warning(problems)}</Callout>
    </div>
  );
}

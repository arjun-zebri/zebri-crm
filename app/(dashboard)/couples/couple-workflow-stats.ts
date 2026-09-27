/**
 * The stat line under the couple's Workflow tab title.
 *
 * Pure, so the counting rules are unit-tested without rendering the tab.
 *
 * @module app/(dashboard)/couples/couple-workflow-stats
 */
import { zonedDateParts } from '@/lib/scheduling/timezone';
import { countPartialSends } from '@/lib/workflows/send-outcome';
import type { WorkflowStepRow } from '@/types/workflows';

import type { TabStat } from './couple-tab-shell';

/**
 * "3 open · 1 overdue · 1 partly failed", as stat parts.
 *
 * - open: pending or waiting steps.
 * - overdue (danger): pending steps due before today in the MC's zone.
 * - partly failed (warning): done sends that reached only some of their
 *   recipients (Task 31 fix round 1, review I1). Those sit in the
 *   collapsed Done strip, so the tab header is where the MC first sees
 *   them.
 *
 * @param steps Every step of the couple's visible workflows.
 * @param timezone The MC's IANA timezone, for "before today".
 * @returns The parts, or undefined when there are no steps (so the stat
 *   line never sits beside the empty state).
 */
export function workflowTabStats(
  steps: readonly WorkflowStepRow[],
  timezone: string,
): TabStat[] | undefined {
  if (steps.length === 0) return undefined;
  const open = steps.filter((s) => s.status === 'pending' || s.status === 'waiting').length;
  const today = zonedDateParts(new Date(), timezone).date;
  const overdue = steps.filter(
    (s) =>
      s.status === 'pending' &&
      s.due_at !== null &&
      zonedDateParts(new Date(s.due_at), timezone).date < today,
  ).length;
  const partial = countPartialSends(steps);

  // "open" is an adjective like "sent" or "overdue", so it is built
  // inline: `tabStat` pluralises a noun and read "2 opens" (live check B5).
  const out: TabStat[] = [{ label: `${open} open` }];
  if (overdue > 0) out.push({ label: `${overdue} overdue`, tone: 'danger' });
  if (partial > 0) out.push({ label: `${partial} partly failed`, tone: 'warning' });
  return out;
}

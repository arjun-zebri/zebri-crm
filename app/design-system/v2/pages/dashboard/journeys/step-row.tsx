import type { ReactNode } from 'react';

/**
 * One setting of the step dialog's panel, on one line: a muted label on
 * the left in a fixed column, so the values line up, and the value
 * filling the rest (a dropdown with its chevron at the panel's edge, a
 * switch). No hint line under it: the label and the value say enough
 * (founder, 2026-10-07).
 *
 * @module app/design-system/v2/pages/dashboard/journeys/step-row
 */

export interface StepRowProps {
  label: string;
  children: ReactNode;
}

/** The row. See {@link StepRowProps}. */
export function StepRow({ label, children }: StepRowProps) {
  return (
    <div className="flex min-h-9 items-center gap-3">
      <dt className="w-28 shrink-0 text-zebra-500">{label}</dt>
      <dd className="flex min-w-0 flex-1 justify-end">{children}</dd>
    </div>
  );
}

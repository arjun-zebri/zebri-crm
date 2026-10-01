import type { ReactNode } from 'react';

/**
 * One row of the step panel's property list: a quiet label in a narrow
 * column and the value beside it, set as text with inline controls
 * rather than a boxed field under a heading. `hint` sits under the value
 * in the muted tone, for the one line of why a setting matters.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/builder/prop-row
 */

export interface PropRowProps {
  label: string;
  /** Links the label to a control that names itself by it. */
  labelId?: string | undefined;
  hint?: ReactNode;
  children: ReactNode;
}

/** A property row. See {@link PropRowProps}. */
export function PropRow({ label, labelId, hint, children }: PropRowProps) {
  return (
    <div className="flex items-start gap-3">
      {/* pt-2 sets the label on the 36px row's text line. */}
      <p id={labelId} className="w-16 shrink-0 pt-2 type-body text-zebra-500">
        {label}
      </p>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex min-h-9 flex-wrap items-center gap-x-1 type-body text-zebra-700">{children}</div>
        {hint ? <p className="type-body text-zebra-500">{hint}</p> : null}
      </div>
    </div>
  );
}

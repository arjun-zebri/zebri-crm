import type { ReactNode } from 'react';

/**
 * The one read-back layout for label and value lists in the paperwork,
 * questionnaire and script dialogs (2026-10-14): a fixed label column
 * (9rem, 12rem from `sm`) in the quiet zebra-500, the value straight
 * after it in zebra-950, so every value shares one edge and sits beside
 * its label rather than across the dialog from it. A value not given
 * reads "Not given", in the faint grey, everywhere. `compact` keeps the
 * 9rem column at every width, for a narrow side panel.
 *
 * @module app/design-system/v2/pages/dashboard/questionnaires/read-back
 */

/** The one word for a value nobody has given. */
export const NOT_GIVEN = 'Not given';

export interface ReadBackProps {
  /** Label and value pairs, in order. An empty value reads {@link NOT_GIVEN}. */
  rows: readonly (readonly [string, ReactNode])[];
  /** Keep the narrow label column at every width (a side panel). */
  compact?: boolean | undefined;
  /** Placement only (margins, padding). */
  className?: string | undefined;
}

/** A read-back list. See {@link ReadBackProps}. */
export function ReadBack({ rows, compact = false, className }: ReadBackProps) {
  return (
    <dl
      className={`grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] content-start gap-x-4 gap-y-2 type-body ${compact ? '' : 'sm:grid-cols-[12rem_minmax(0,1fr)]'}${className ? ` ${className}` : ''}`}
    >
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-zebra-500">{label}</dt>
          <dd className={value === '' || value == null ? 'text-zebra-400' : 'text-zebra-950'}>{value === '' || value == null ? NOT_GIVEN : value}</dd>
        </div>
      ))}
    </dl>
  );
}

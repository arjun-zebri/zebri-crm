import type { ReactNode } from 'react';

import { GUTTER } from './profile-header';

/**
 * The two-column shape every profile section shares: the main content on
 * the left and a panel on the right, split by a hairline. From `lg` each
 * column scrolls on its own; below that the panel follows the content.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/split-section
 */

export interface SplitSectionProps {
  main: ReactNode;
  aside: ReactNode;
  /** The panel's accessible name: "Details", "At a glance". */
  asideLabel: string;
  /**
   * Show the panel only from `lg`, for a panel that is all about the
   * selected row: below `lg` that opens under the row instead.
   */
  wideOnly?: boolean | undefined;
}

/** A section in two columns. See {@link SplitSectionProps}. */
export function SplitSection({ main, aside, asideLabel, wideOnly }: SplitSectionProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto motion-safe:animate-[fade-in_200ms_ease-out_both] lg:flex-row lg:overflow-hidden">
      <div className={`min-w-0 flex-1 py-8 lg:overflow-y-auto ${GUTTER}`}>{main}</div>
      <aside
        aria-label={asideLabel}
        className={`${wideOnly ? 'hidden lg:block' : ''} shrink-0 border-t border-zebra-200 py-8 lg:w-88 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:px-8 ${GUTTER}`}
      >
        {aside}
      </aside>
    </div>
  );
}

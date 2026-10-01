import type { ReactNode } from 'react';

/**
 * The one group heading style inside the profile's lists ("This week",
 * "In progress"): a quiet line over its rows, the same spacing everywhere.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/section-frame
 */

/** A titled group inside a section. */
export function ProfileGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-2">
      <h4 className="type-body text-zebra-500">{title}</h4>
      {children}
    </section>
  );
}

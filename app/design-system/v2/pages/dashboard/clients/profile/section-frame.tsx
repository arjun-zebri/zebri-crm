import type { ReactNode } from 'react';

import { GroupLabel } from '@/components/ui-v2/group-label';

/**
 * The one group heading style inside the profile's lists ("This week",
 * "In progress", "Past calls"): v2's `GroupLabel` over its rows, the same
 * spacing everywhere. The call checklist and a call's updates use the
 * same label.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/section-frame
 */

/** A titled group inside a section. */
export function ProfileGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-2">
      <GroupLabel as="h4">{title}</GroupLabel>
      {children}
    </section>
  );
}

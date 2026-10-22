import type { ReactNode } from 'react';

import { GroupLabel } from '@/components/ui-v2/group-label';

/**
 * The brand kit's settings list (founder's mockup, 2026-10-11): a quiet
 * group name ("Identity", "Type", "Shape"), then one row per setting
 * with its name on the left and its value on the right as a small
 * control, a hairline under each row. A hint under the name only where
 * the name alone would not say it (the Email tab's fields).
 *
 * @module app/design-system/v2/pages/dashboard/brand/kit-row
 */

/** A group of rows under a muted name. */
export function KitGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <GroupLabel as="h3" className="pb-1">
        {title}
      </GroupLabel>
      <div>{children}</div>
    </section>
  );
}

/** One setting: its name (and a hint, when it needs one) and its control. */
export function KitRow({ label, hint, children }: { label: string; hint?: string | undefined; children: ReactNode }) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-6 border-b border-hairline py-2">
      <div className="min-w-0">
        <p className="type-body text-zebra-950">{label}</p>
        {hint ? <p className="type-body text-zebra-500">{hint}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

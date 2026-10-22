/**
 * The titled section shared by the prospect modal sections. Kept as
 * plain layout so each section file only holds its own behaviour.
 *
 * @module features/outreach/views/prospects/drawer-parts
 */
import type { ReactNode } from 'react';

/** A titled section of the prospect modal. `action` sits on the right of the heading. */
export function DrawerSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-body font-semibold text-text">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

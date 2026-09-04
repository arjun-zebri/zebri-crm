/**
 * A titled section of the public API docs page.
 *
 * @module app/docs/lead-capture-api/_components/doc-section
 */
import type { ReactNode } from 'react';

export function DocSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="space-y-3">
      <h2 className="text-section font-semibold text-text">{title}</h2>
      <div className="space-y-3 text-body text-text-muted">{children}</div>
    </section>
  );
}

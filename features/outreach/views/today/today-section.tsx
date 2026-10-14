/**
 * Layout pieces shared by every Today list: a titled section, the
 * bordered list box it holds, and the empty line when a list has
 * nothing in it.
 *
 * @module features/outreach/views/today/today-section
 */
import type { ReactNode } from 'react';

/** A titled block on the Today view. `count` shows beside the title when given. */
export function TodaySection({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-body font-semibold text-text">{title}</h2>
        {count !== undefined && <span className="text-body text-text-subtle">{count}</span>}
      </div>
      {children}
    </section>
  );
}

/** The bordered box a list's rows sit in. Rows are separated by hairlines inside it. */
export function TodayList({ children }: { children: ReactNode }) {
  return <ul className="rounded-control border border-border bg-surface divide-y divide-border">{children}</ul>;
}

/** Empty line for a list with nothing to do. Muted, one sentence. */
export function TodayEmpty({ children }: { children: ReactNode }) {
  return <p className="text-body text-text-muted">{children}</p>;
}

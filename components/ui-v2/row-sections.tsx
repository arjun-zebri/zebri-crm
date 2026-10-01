'use client';

import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Collapse } from '@/components/ui-v2/collapse';
import { Panel } from '@/components/ui-v2/panel';

/**
 * Design system v2 row sections (preview): a list broken into sections
 * by what needs attention, each section a heading (a coloured dot, the
 * title, a count, an optional note) over its rows on a glass `Panel`,
 * folding shut from the heading. Sections are separated by space, not
 * rules, and a section with nothing in it is left out rather than shown
 * empty. Sections marked `shut` start folded: the settled ones (Paid,
 * Signed) the user rarely opens. The heading is sized to its content so
 * the chevron sits by the title, not a screen's width away.
 *
 * The caller renders each row and its `<li>`; see Clients' For you and
 * the Payments Invoices and Contracts tabs.
 *
 * @example
 * ```tsx
 * <RowSections
 *   sections={[{ id: 'overdue', title: 'Overdue', dot: 'bg-danger' }, { id: 'paid', title: 'Paid', dot: 'bg-grass-500', shut: true }]}
 *   items={invoices}
 *   sectionOf={(i) => i.status}
 *   renderRow={(i) => <li key={i.id}>…</li>}
 * />
 * ```
 *
 * @module components/ui-v2/row-sections
 */

/** One section's heading. */
export interface RowSection<S extends string> {
  id: S;
  title: string;
  /** Background utility for the dot, e.g. `bg-danger`. */
  dot: string;
  /** Muted words after the count, e.g. "Likely to book soon". */
  note?: string | undefined;
  /** Starts folded. */
  shut?: boolean | undefined;
}

export interface RowSectionsProps<S extends string, T> {
  sections: readonly RowSection<S>[];
  items: readonly T[];
  sectionOf: (item: T) => S;
  renderRow: (item: T) => ReactNode;
  /** The heading's count; the number of rows when left out. */
  count?: ((rows: T[]) => number) | undefined;
  /** A note worked out from the rows (a total), used when the section has none. */
  note?: ((rows: T[]) => string) | undefined;
}

/** v2 row sections. See {@link RowSectionsProps}. */
export function RowSections<S extends string, T>({ sections, items, sectionOf, renderRow, count, note }: RowSectionsProps<S, T>) {
  const [shut, setShut] = useState<ReadonlySet<S>>(() => new Set(sections.filter((s) => s.shut).map((s) => s.id)));
  const toggle = (id: S) =>
    setShut((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return (
    <div className="space-y-6">
      {sections.map((s) => {
        const rows = items.filter((i) => sectionOf(i) === s.id);
        if (rows.length === 0) return null;
        const open = !shut.has(s.id);
        const words = s.note ?? note?.(rows);
        return (
          <section key={s.id} aria-labelledby={`rows-${s.id}`}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggle(s.id)}
              className="group inline-flex max-w-full items-center gap-2.5 rounded-button py-1.5 pb-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500"
            >
              <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-pill ${s.dot}`} />
              <span id={`rows-${s.id}`} className="type-label text-zebra-950">
                {s.title}
              </span>
              <span className="type-body tabular-nums text-zebra-500">{count ? count(rows) : rows.length}</span>
              {words ? <span className="hidden min-w-0 truncate type-body tabular-nums text-zebra-500 sm:block">{words}</span> : null}
              <ChevronDown
                aria-hidden="true"
                strokeWidth={1.5}
                className={`size-4 shrink-0 text-zebra-300 transition-[rotate,color] duration-200 group-hover:text-zebra-950 motion-reduce:transition-none ${open ? '' : '-rotate-90'}`}
              />
            </button>
            <Collapse open={open}>
              <Panel className="p-2">
                <ul>{rows.map(renderRow)}</ul>
              </Panel>
            </Collapse>
          </section>
        );
      })}
    </div>
  );
}

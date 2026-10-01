'use client';

import { useRef, type KeyboardEvent } from 'react';

/**
 * Design system v2 tabs (preview): the views of one page (For you,
 * Board, List), as a row of labels with a short ink bar under the
 * current one. For switching what a whole page shows; to switch a small
 * setting inside a form, use `Segmented`.
 *
 * A real `tablist`: Left and Right move between tabs, Home and End jump
 * to the ends, and only the current tab is in the Tab order. The panel
 * the tabs control is the caller's; give it `role="tabpanel"` and
 * `aria-labelledby={tabId(id, value)}`.
 *
 * @example
 * ```tsx
 * <Tabs id="clients-view" label="View" items={[{ value: 'list', label: 'List' }]} value={view} onChange={setView} />
 * <div role="tabpanel" aria-labelledby={tabId('clients-view', view)}>…</div>
 * ```
 *
 * @module components/ui-v2/tabs
 */

/** One tab. */
export interface TabItem<T extends string> {
  value: T;
  label: string;
  /** A quiet count after the label. */
  count?: number | undefined;
  /**
   * What the count counts, "overdue": colours it (red for late money,
   * amber for waiting) so it is not read as the tab's total, and is read
   * out after the number. Hidden at 0.
   */
  countOf?: { word: string; tone: 'danger' | 'warning' } | undefined;
  /** A small grass dot before the label: this view has something new. */
  dot?: boolean | undefined;
}

const COUNT_TONE = { danger: 'text-danger', warning: 'text-warning-ink' } as const;

export interface TabsProps<T extends string> {
  /** Prefix for each tab's element id; see {@link tabId}. */
  id: string;
  /** Names the tab list for assistive tech; not shown. */
  label: string;
  items: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** The element id of one tab, for the panel's `aria-labelledby`. */
export const tabId = (id: string, value: string) => `${id}-${value}`;

/** v2 tabs. See {@link TabsProps}. */
export function Tabs<T extends string>({ id, label, items, value, onChange }: TabsProps<T>) {
  const list = useRef<HTMLDivElement>(null);
  function onKeyDown(e: KeyboardEvent) {
    const i = items.findIndex((t) => t.value === value);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: items.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const item = items[(next + items.length) % items.length];
    if (!item) return;
    onChange(item.value);
    list.current?.querySelector<HTMLElement>(`#${CSS.escape(tabId(id, item.value))}`)?.focus();
  }
  return (
    <div ref={list} role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-6">
      {items.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            id={tabId(id, t.value)}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.value)}
            // The bar is drawn by `after:`, so picking a tab never moves the labels.
            className={`relative flex h-9 items-center gap-1.5 rounded-check type-label transition-colors duration-150 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-pill after:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500 motion-reduce:transition-none ${
              on ? 'text-zebra-950 after:bg-zebra-950' : 'text-zebra-500 after:bg-transparent hover:text-zebra-950'
            }`}
          >
            {t.dot ? <span aria-hidden="true" className="size-1.5 rounded-pill bg-grass-500" /> : null}
            {t.label}
            {t.count !== undefined && !(t.countOf && t.count === 0) ? (
              <span className={`tabular-nums ${t.countOf ? COUNT_TONE[t.countOf.tone] : 'text-zebra-400'}`}>
                {t.count}
                {t.countOf ? <span className="sr-only"> {t.countOf.word}</span> : null}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

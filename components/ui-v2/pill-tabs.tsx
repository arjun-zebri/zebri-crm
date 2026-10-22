'use client';

import { useState, type ReactNode } from 'react';

import { DISABLED } from './control-styles';

/**
 * Design system v2 page tabs (preview): a row of plain words for
 * switching between a handful of top-level things on a page (a journey
 * per type of work), each with an optional count. The picked one is ink
 * and a weight heavier; the rest are grey. No pill, fill or edge at rest,
 * only the house `hover` tint (user, 2026-10-16, page bar option D: the
 * white and frosted pills before were too heavy for a minimal app). Use
 * Segmented for a view switch inside a panel, and these for the page's
 * own subjects. Still named PillTabs so callers keep compiling.
 *
 * Buttons with `aria-pressed` inside a labelled group, like Segmented.
 * `menu` sits inside the picked pill, after its count (a ⋯ that acts on
 * that one subject, shown on hover or focus), so an option can only ever
 * mean the pill it is in. With `onRename`, double-clicking a pill (or
 * setting `renaming` to it) turns its name into a field in place: Enter
 * or leaving it saves, Escape cancels. `after` sits at the end of the row
 * (a dashed + to add one).
 *
 * @example
 * ```tsx
 * <PillTabs label="Journey" options={ids} labels={names} counts={counts} value={id} onChange={setId} menu={<JourneyMenu />} onRename={rename} after={<AddButton />} />
 * ```
 *
 * @module components/ui-v2/pill-tabs
 */

export interface PillTabsProps<T extends string> {
  /** Names the group for assistive tech; not shown. */
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** What each option shows, when its value is not its label. */
  labels?: Partial<Record<T, string>> | undefined;
  /** A quieter count after each option's label. */
  counts?: Partial<Record<T, number>> | undefined;
  /** Inside the picked pill, after its count: a menu for that one subject. */
  menu?: ReactNode;
  /** Renames a pill in place; double-click starts it. */
  onRename?: ((value: T, name: string) => void) | undefined;
  /** The pill being renamed, when started from outside (a menu's Rename). */
  renaming?: T | null | undefined;
  onRenamingChange?: ((value: T | null) => void) | undefined;
  /** At the end of the row, e.g. a dashed + to add one. */
  after?: ReactNode;
  /** Greys the row out and stops a pick. */
  disabled?: boolean | undefined;
}

// Words only: the picked one ink and a weight heavier (500 against 400).
const ON = 'type-label text-zebra-950 hover:bg-hover';
const OFF = 'type-body text-zebra-500 hover:bg-hover hover:text-zebra-950';

const PILL =
  'flex h-9 items-center rounded-panel transition-colors duration-150 focus-mark-within motion-reduce:transition-none';

/** v2 pill tabs. See {@link PillTabsProps}. */
export function PillTabs<T extends string>({
  label,
  options,
  value,
  onChange,
  labels,
  counts,
  menu,
  onRename,
  renaming,
  onRenamingChange,
  after,
  disabled = false,
}: PillTabsProps<T>) {
  const [own, setOwn] = useState<T | null>(null);
  const editing = renaming !== undefined ? renaming : own;
  const setEditing = (v: T | null) => (onRenamingChange ? onRenamingChange(v) : setOwn(v));
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1">
      {options.map((option) => {
        const on = option === value;
        const name = labels?.[option] ?? option;
        const count =
          counts?.[option] !== undefined ? (
            <span className="type-numeric text-zebra-400">{counts[option]}</span>
          ) : null;
        return (
          <div key={option} className={`group ${PILL} ${on ? ON : OFF}`}>
            {editing === option && onRename ? (
              <input
                aria-label={`Rename ${name}`}
                defaultValue={name}
                autoFocus
                onFocus={(e) => e.currentTarget.select()}
                onBlur={(e) => {
                  const next = e.currentTarget.value.trim();
                  if (next && next !== name) onRename(option, next);
                  setEditing(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') {
                    e.currentTarget.value = name;
                    e.currentTarget.blur();
                  }
                }}
                // As wide as the name it replaces, so the pill does not jump.
                size={Math.max(name.length, 4)}
                className="ml-2.5 bg-transparent outline-none"
              />
            ) : (
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onChange(option)}
                onDoubleClick={onRename ? () => setEditing(option) : undefined}
                disabled={disabled}
                className={`flex h-full items-center gap-2 rounded-panel pl-2.5 ${DISABLED} ${on && menu ? 'pr-1' : 'pr-2.5'}`}
              >
                {name}
                {count}
              </button>
            )}
            {on && menu ? (
              <span className="flex items-center pr-1.5">{menu}</span>
            ) : editing === option ? (
              <span className="w-4" />
            ) : null}
          </div>
        );
      })}
      {after}
    </div>
  );
}

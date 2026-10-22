'use client';

import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import { CheckIcon, ChevronDownIcon } from '@/components/ui-v2/icons';

import { BoxedLabel } from './boxed-label';
import { boxedControl, MENU_ITEM, MENU_RULE, MENU_SURFACE } from './control-styles';

/**
 * Design system v2 combo field (preview): a boxed pick-one for a long
 * list, typed to narrow it (user, 2026-10-15: two hundred countries in a
 * scrolling menu was the worst answer on a phone). Type "ger" and the
 * list is Germany first, then anything else containing it; arrow keys
 * move, Enter picks, Escape puts the last pick back. `pinned` options
 * lead the list while nothing is typed (Australia), under a rule. Leaving
 * the box with an exact name typed picks it; anything else goes back to
 * the last pick, so the value is always one of the options or "". The
 * ARIA combobox pattern: the box is the `combobox`, the list a `listbox`.
 *
 * @example
 * ```tsx
 * <ComboField label="Country you were born in" options={COUNTRIES} pinned={['Australia']} value={c} onChange={setC} />
 * ```
 *
 * @module components/ui-v2/combo-field
 */

export interface ComboFieldProps {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  /** Options listed first, above a rule, while nothing is typed. */
  pinned?: readonly string[] | undefined;
  optional?: boolean | undefined;
  help?: string | undefined;
  error?: string | undefined;
  /** Grey text in the empty box; "Start typing" by default. */
  placeholder?: string | undefined;
  /** What the list says when nothing matches. */
  empty?: string | undefined;
}

/** The options matching what is typed: those starting with it first, then those containing it. */
function matches(options: readonly string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  const starts = options.filter((o) => o.toLowerCase().startsWith(q));
  return [...starts, ...options.filter((o) => !starts.includes(o) && o.toLowerCase().includes(q))];
}

/** v2 combo field. See {@link ComboFieldProps}. */
export function ComboField({ label, options, value, onChange, pinned = [], optional = false, help, error, placeholder = 'Start typing', empty = 'Nothing by that name' }: ComboFieldProps) {
  const id = useId();
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [at, setAtState] = useState(0);
  // Read by Enter, so a fast ArrowDown then Enter picks the row the arrow reached, not the one before it.
  const atNow = useRef(0);
  const setAt = (next: number | ((i: number) => number)) => {
    atNow.current = typeof next === 'function' ? next(atNow.current) : next;
    setAtState(atNow.current);
  };
  const typing = query !== null && query !== value;
  const lead = typing ? [] : pinned.filter((o) => options.includes(o));
  const list = typing ? matches(options, query) : [...lead, ...options.filter((o) => !lead.includes(o))];
  // The row the arrow keys reach stays in view as the list scrolls.
  useEffect(() => {
    if (open) document.getElementById(`${id}-${at}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, at, id]);
  const pick = (option: string) => {
    onChange(option);
    setQuery(null);
    setOpen(false);
  };
  const leave = () => {
    const exact = typing ? options.find((o) => o.toLowerCase() === query.trim().toLowerCase()) : undefined;
    if (exact && exact !== value) onChange(exact);
    setQuery(null);
    setOpen(false);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setAt((i) => Math.max(0, Math.min(list.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))));
    } else if (e.key === 'Enter' && open && list[atNow.current]) {
      e.preventDefault();
      pick(list[atNow.current]!);
    } else if (e.key === 'Escape') {
      setQuery(null);
      setOpen(false);
    }
  };
  const describedBy = [help ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <BoxedLabel htmlFor={id} optional={optional}>
        {label}
      </BoxedLabel>
      <div className="relative">
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && list[at] ? `${id}-${at}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          placeholder={placeholder}
          value={query ?? value}
          onFocus={(e) => {
            e.target.select();
            setOpen(true);
            setAt(0);
          }}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setAt(0);
          }}
          onBlur={leave}
          onKeyDown={onKey}
          className={`${boxedControl(Boolean(error))} pr-9`}
        />
        <ChevronDownIcon aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zebra-500" />
        {open ? (
          <ul id={`${id}-list`} role="listbox" aria-label={label} className={`${MENU_SURFACE} absolute inset-x-0 top-full mt-1 max-h-64 overflow-y-auto`}>
            {list.length ? (
              list.map((o, i) => (
                <Fragment key={o}>
                  <li
                    id={`${id}-${i}`}
                    role="option"
                    aria-selected={o === value}
                    data-highlighted={i === at ? '' : undefined}
                    // Down, not click: a click would blur the box first and close the list under the pointer.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(o);
                    }}
                    onMouseMove={() => setAt(i)}
                    className={MENU_ITEM}
                  >
                    {o}
                    {o === value ? <CheckIcon aria-hidden="true" className="ml-auto size-4 text-selected" /> : null}
                  </li>
                  {i === lead.length - 1 ? <li role="separator" className={MENU_RULE} /> : null}
                </Fragment>
              ))
            ) : (
              <li className="px-2 py-1.5 type-body text-zebra-500">{empty}</li>
            )}
          </ul>
        ) : null}
      </div>
      {help ? (
        <p id={`${id}-help`} className={error ? 'sr-only' : 'mt-1.5 type-body text-zebra-500'}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 type-body text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

'use client';

import { useState, type KeyboardEvent, type ReactNode } from 'react';

import { MENU_RULE } from './control-styles';
import { MenuOption } from './popover';

/**
 * Design system v2 value menu: the one way a setting takes a custom value
 * (user ruling, 2026-10-15, "type to find", like Linear and Raycast). The
 * menu opens on a quiet typing line, "Type a number…", over the common
 * choices. Typing replaces the choices with what the text could mean:
 * "9" lists "9 days", "9 weeks", "9 months"; "9 w" narrows to "9 weeks".
 * Enter takes the first. There is no "Custom…" row and no second screen:
 * typing is the custom value.
 *
 * Rejected on the way (2026-10-14/15): a tinted number with a unit menu
 * beside it (a tiny target), a stepper, a settings list, a sentence, an
 * editor with a green Done and a units switch, and Custom… turning into
 * a typing row.
 *
 * A value that is not one of the presets is listed first, ticked, so the
 * menu always shows what is set. Arrow keys move between the line and the
 * rows. Usually shown through `ValuePicker`, its button; a chip or row
 * that already opens a menu renders `ValueMenu` inside it.
 *
 * @example
 * ```tsx
 * <ValueMenu label="Due in" value={due} presets={DUE} show={amountLabel}
 *   read={(t) => readAmount(t, ['days', 'weeks', 'months'], MAX)} onPick={setDue} />
 * ```
 *
 * @module components/ui-v2/value-menu
 */

export interface ValueMenuProps<T> {
  /** Names the setting for screen readers: "Due in". */
  label: string;
  value: T;
  /** The common choices, listed until something is typed. */
  presets: readonly T[];
  /** How a value reads, on its row and its button ("7 days"). Two values that read the same are the same. */
  show: (value: T) => string;
  /** What typed text could mean, best first; none when it reads as nothing. */
  read: (text: string) => readonly T[];
  onPick: (value: T) => void;
  /** The typing line's prompt; "Type a number…" by default. */
  placeholder?: string | undefined;
  /** "text" when the value is typed in words ("1 hr 30"); numeric by default. */
  inputMode?: 'numeric' | 'text' | undefined;
  /** One plain line on what the setting does, over the typing line. */
  about?: ReactNode;
  /** Said when the typed text reads as nothing; "Not a number" by default. */
  invalid?: string | undefined;
  /** How a value reads on its row, when shorter than `show` ("2 weeks" on a "2 weeks before the event" button). */
  row?: ((value: T) => string) | undefined;
  /**
   * A second choice that shapes the value, listed under a rule after the
   * values ("Before the event", "After this invoice"); hidden while typing.
   */
  also?: readonly { label: string; value: T; selected: boolean }[] | undefined;
}

/** Up and Down step between the typing line and the rows, as a menu's keys do. */
function arrows(e: KeyboardEvent<HTMLDivElement>) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault();
  const stops = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('input, [role="menuitemradio"]'));
  const at = stops.indexOf(document.activeElement as HTMLElement);
  const to = Math.min(stops.length - 1, Math.max(0, at + (e.key === 'ArrowDown' ? 1 : -1)));
  stops[to]?.focus();
}

/** The menu's content. See the module docs. */
export function ValueMenu<T>({ label, value, presets, show, read, onPick, placeholder = 'Type a number…', inputMode = 'numeric', about, invalid = 'Not a number', row = show, also }: ValueMenuProps<T>) {
  const [text, setText] = useState('');
  const typed = text.trim() !== '';
  const current = show(value);
  const found = typed ? read(text) : presets.some((p) => show(p) === current) ? presets : [value, ...presets];
  return (
    <div onKeyDown={arrows}>
      {about ? <p className="px-2 pb-2 pt-1.5 text-pretty type-body text-zebra-500">{about}</p> : null}
      <input
        autoFocus
        aria-label={`${label}: type a value`}
        autoComplete="off"
        inputMode={inputMode}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          const first = found[0];
          if (typed && first !== undefined) onPick(first);
        }}
        className="h-8 w-full bg-transparent px-2 type-body text-zebra-950 outline-none placeholder:text-zebra-400"
      />
      <div className={MENU_RULE} />
      {found.map((v) => (
        <MenuOption key={show(v)} selected={show(v) === current} onSelect={() => onPick(v)}>
          {row(v)}
        </MenuOption>
      ))}
      {typed && found.length === 0 ? <p className="flex h-8 items-center px-2 type-body text-zebra-400">{invalid}</p> : null}
      {also?.length && !typed ? (
        <>
          <div className={MENU_RULE} />
          {also.map((a) => (
            <MenuOption key={a.label} selected={a.selected} onSelect={() => onPick(a.value)}>
              {a.label}
            </MenuOption>
          ))}
        </>
      ) : null}
    </div>
  );
}

/** A number and its unit: 25 "%", 7 "days". */
export interface Amount<U extends string = string> {
  n: number;
  unit: U;
}

/** "25%", "7 days", "1 week". A unit ending in "s" drops it for one. */
export function amountLabel({ n, unit }: Amount): string {
  if (unit === '%') return `${n}%`;
  return `${n} ${n === 1 && unit.endsWith('s') ? unit.slice(0, -1) : unit}`;
}

/**
 * What typed text could mean as an amount: its number in each unit that
 * takes it, narrowed by any letters typed ("9 w" is weeks only). Empty
 * when there is no number, or it is under `min` or over every unit's max.
 */
export function readAmount<U extends string>(text: string, units: readonly U[], max: Record<U, number>, min = 1): Amount<U>[] {
  const digits = text.replace(/\D/g, '').slice(0, 4);
  if (!digits) return [];
  const n = Number(digits);
  const word = text.replace(/[\d\s]/g, '').toLowerCase();
  return units.filter((u) => n >= min && n <= max[u] && (!word || u.toLowerCase().startsWith(word))).map((unit) => ({ n, unit }));
}

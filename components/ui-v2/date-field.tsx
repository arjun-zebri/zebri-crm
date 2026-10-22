'use client';

import { useState } from 'react';

import { CalendarIcon } from '@/components/ui-v2/icons';
import { Input, type InputProps } from '@/components/ui-v2/input';

/**
 * Design system v2 date field (preview): a typed date in the v2 input,
 * for when a date is quicker to type than to click to. It takes the
 * forms people actually type ("1 Jul 2026", "1/7/26", "2026-07-01") and,
 * once the field is left or Enter is pressed, reads the date back as
 * "1 Jul 2026" so there is no doubt which date it took. Day first, as
 * in Australia. Something it cannot read keeps the text and shows the
 * error under the field rather than guessing. The value is a local
 * "YYYY-MM-DD" string, or "" for none. Pair it with `RangeCalendar`
 * (see `DateRangePicker`) when picking by eye matters too.
 *
 * @example
 * ```tsx
 * <DateField label="From" value={from} onChange={setFrom} />
 * ```
 *
 * @module components/ui-v2/date-field
 */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/** "1 Jul 2026" for a "YYYY-MM-DD" string; "" for none. */
export const formatDate = (iso: string) => {
  if (!iso) return '';
  // Spelled out here: the en-AU short month is "June" and "Sept", which
  // sit oddly beside three-letter "Jul" and "Oct".
  const [y, m, d] = iso.split('-').map(Number);
  const name = MONTHS[m! - 1]!;
  return `${d} ${name[0]!.toUpperCase()}${name.slice(1)} ${y}`;
};

/** Reads a typed date, day first; `null` when it is not a real date. */
export function parseDate(text: string): string | null {
  const t = text.trim().toLowerCase().replace(/,/g, ' ');
  let d: number, m: number, y: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  const num = /^(\d{1,2})[/.\s-](\d{1,2})[/.\s-](\d{2}|\d{4})$/.exec(t);
  const word = /^(\d{1,2})\s+([a-z]+)\s+(\d{2}|\d{4})$/.exec(t);
  if (iso) [d, m, y] = [Number(iso[3]), Number(iso[2]), Number(iso[1])];
  else if (num) [d, m, y] = [Number(num[1]), Number(num[2]), Number(num[3])];
  else if (word) {
    const i = MONTHS.indexOf(word[2]!.slice(0, 3));
    if (i < 0) return null;
    [d, m, y] = [Number(word[1]), i + 1, Number(word[3])];
  } else return null;
  if (y < 100) y += 2000;
  const date = new Date(y, m - 1, d);
  // Rejects 31 Feb and the like, which Date quietly rolls into March.
  if (date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

export interface DateFieldProps {
  label: string;
  /** "YYYY-MM-DD", or "" for none. */
  value: string;
  onChange: (iso: string) => void;
  /** Called when the field takes focus (a range picker notes which end is being set). */
  onFocus?: (() => void) | undefined;
  /** Draws the field as the one a calendar click will fill. */
  active?: boolean | undefined;
  /** A soft grey well instead of no box, as `Input`'s `filled`. */
  filled?: boolean | undefined;
  /** The glyph leading the row; a calendar by default. */
  icon?: InputProps['icon'];
  /** A ledger row, as `Input`'s `row`: the name on the left, the date beside it. */
  row?: boolean | undefined;
  /** The boxed field, as `Input`'s `boxed`: the name over a white box, for the entry screens and the couple's public form. */
  boxed?: boolean | undefined;
  /** With `boxed`: "(optional)" after the name. */
  optional?: boolean | undefined;
  /** Grey text in the empty field, such as an example date ("e.g. 1 Jul 1990"). */
  placeholder?: string | undefined;
  /** Helper text, as `Input`'s: under the date, or in a row an info mark by the name. */
  help?: string | undefined;
  /** A rule the date breaks, from outside ("Has to be in the past"); shown when the field has no error of its own. */
  error?: string | undefined;
  /**
   * Text typed earlier that could not be read, shown again with its error
   * when the field mounts, so stepping away from a question does not
   * quietly lose what was typed.
   */
  draft?: string | undefined;
  /** Called with the typed text when it cannot be read, and with "" once a date is read. */
  onInvalid?: ((text: string) => void) | undefined;
}

/** What the field says of text it cannot read as a date. */
const UNREADABLE = 'Not a real date. Try one like 1 Jul 2026';

/** v2 date field. See {@link DateFieldProps}. */
export function DateField({
  label,
  value,
  onChange,
  onFocus,
  active = false,
  filled = false,
  icon = CalendarIcon,
  row = false,
  boxed = false,
  optional = false,
  placeholder,
  help,
  error: outside,
  draft = '',
  onInvalid,
}: DateFieldProps) {
  const unread = Boolean(draft.trim()) && !parseDate(draft);
  const [text, setText] = useState(unread ? draft : formatDate(value));
  const [error, setError] = useState<string | undefined>(unread ? UNREADABLE : undefined);
  // A new value from outside (a calendar click) replaces whatever was
  // typed. Adjusted during render, as React advises, not in an effect.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(formatDate(value));
    setError(undefined);
  }
  const commit = () => {
    // Emptied: no date, and nothing to complain about.
    if (!text.trim()) {
      setError(undefined);
      onInvalid?.('');
      if (value) onChange('');
      return;
    }
    if (text.trim() === formatDate(value)) return;
    const iso = parseDate(text);
    if (!iso) {
      setError(UNREADABLE);
      onInvalid?.(text);
      return;
    }
    setError(undefined);
    onInvalid?.('');
    setText(formatDate(iso));
    onChange(iso);
  };
  return (
    <Input
      label={label}
      help={help}
      value={text}
      error={error ?? outside}
      onChange={(e) => setText(e.target.value)}
      onFocus={onFocus}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
      filled={filled}
      // The end a calendar click will fill holds the pressed tint, not a ring.
      className={active ? 'bg-pressed' : undefined}
      // Boxed, the name is over the box, so the calendar would only crowd it.
      icon={boxed ? undefined : icon}
      row={row}
      boxed={boxed}
      optional={optional}
      placeholder={placeholder}
    />
  );
}

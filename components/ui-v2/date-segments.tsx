'use client';

import { useRef, useState, type ClipboardEvent, type FocusEvent, type KeyboardEvent } from 'react';

import { parseDate } from './date-field';

/**
 * The typed half of `CalendarField`: one box split into DD / MM / YYYY,
 * as Apple's and React Aria's date fields are (user, 2026-10-15: a date
 * someone knows is quickest typed, and a grid of years read as cheap).
 * Digits only; a part full moves to the next, Backspace in an empty part
 * goes back, "/" or "." jumps on, arrows step a part up or down, and a
 * whole date pasted ("14/03/1994", "14 Mar 1994") fills all three. A
 * complete real date is reported as it is typed; leaving the box with a
 * part missing, or a date that is not real, reports the problem.
 *
 * @module components/ui-v2/date-segments
 */

type Part = 'd' | 'm' | 'y';
type Parts = Record<Part, string>;
const ORDER: Part[] = ['d', 'm', 'y'];
const LEN: Record<Part, number> = { d: 2, m: 2, y: 4 };
const NAME: Record<Part, string> = { d: 'Day', m: 'Month', y: 'Year' };
const HOLD: Record<Part, string> = { d: 'DD', m: 'MM', y: 'YYYY' };

const fromIso = (iso: string): Parts => {
  const [y = '', m = '', d = ''] = iso ? iso.split('-') : [];
  return { d, m, y };
};
const isoOf = (p: Parts) => (p.d && p.m && p.y.length === 4 ? parseDate(`${p.d} ${p.m} ${p.y}`) : null);

export interface DateSegmentsProps {
  /** The first part's id, for the field's label. */
  id: string;
  /** "YYYY-MM-DD", or "". */
  value: string;
  onChange: (iso: string) => void;
  /** Called with what is wrong once focus leaves, or null when nothing is. */
  onProblem: (problem: string | null) => void;
  /** The latest year a part can step to. */
  maxYear: number;
  describedBy?: string | undefined;
  invalid?: boolean | undefined;
}

/** The three parts. See {@link DateSegmentsProps}. */
export function DateSegments({ id, value, onChange, onProblem, maxYear, describedBy, invalid }: DateSegmentsProps) {
  const [parts, setParts] = useState<Parts>(() => fromIso(value));
  // A value from outside (a calendar click) replaces what was typed, adjusted during render.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    if (isoOf(parts) !== value) setParts(fromIso(value));
  }
  const refs = useRef<Record<Part, HTMLInputElement | null>>({ d: null, m: null, y: null });
  const move = (part: Part, by: number) => refs.current[ORDER[ORDER.indexOf(part) + by] ?? part]?.focus();
  const put = (next: Parts) => {
    setParts(next);
    const iso = isoOf(next);
    if (iso) {
      setSeen(iso);
      onChange(iso);
      onProblem(null);
    }
  };
  const type = (part: Part, raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, LEN[part]);
    put({ ...parts, [part]: digits });
    // A day of 4 or more, or a month of 2 or more, cannot take a second digit.
    const full = digits.length === LEN[part] || (part === 'd' && Number(digits) > 3) || (part === 'm' && Number(digits) > 1);
    if (full && part !== 'y') move(part, 1);
  };
  const step = (part: Part, by: number) => {
    const [lo, hi] = part === 'd' ? [1, 31] : part === 'm' ? [1, 12] : [1900, maxYear];
    const now = Number(parts[part]) || (part === 'y' ? 1990 : lo);
    const next = Math.min(hi, Math.max(lo, now + by));
    put({ ...parts, [part]: String(next).padStart(LEN[part], '0') });
  };
  const onKey = (part: Part, e: KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      step(part, e.key === 'ArrowUp' ? 1 : -1);
    } else if (e.key === 'Backspace' && !el.value) {
      e.preventDefault();
      move(part, -1);
    } else if (['/', '.', '-', ' '].includes(e.key)) {
      e.preventDefault();
      move(part, 1);
    } else if (e.key === 'ArrowLeft' && el.selectionStart === 0) move(part, -1);
    else if (e.key === 'ArrowRight' && el.selectionStart === el.value.length) move(part, 1);
  };
  const paste = (e: ClipboardEvent<HTMLInputElement>) => {
    const iso = parseDate(e.clipboardData.getData('text'));
    if (!iso) return;
    e.preventDefault();
    put(fromIso(iso));
  };
  const leave = (e: FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    const given = ORDER.filter((p) => parts[p]).length;
    if (given === 0) {
      onProblem(null);
      if (value) onChange('');
    } else if (given < 3 || parts.y.length < 4) onProblem('Add the day, month and four-digit year');
    else if (!isoOf(parts)) onProblem('Not a real date. Check the day and month');
  };
  return (
    <div role="group" aria-label="Date" onBlur={leave} className="flex min-w-0 items-center">
      {ORDER.map((part, i) => (
        <span key={part} className="flex items-center">
          {i ? <span aria-hidden="true" className="px-1 text-zebra-300">/</span> : null}
          <input
            ref={(el) => {
              refs.current[part] = el;
            }}
            id={i === 0 ? id : undefined}
            aria-label={NAME[part]}
            aria-describedby={describedBy}
            aria-invalid={invalid ? true : undefined}
            inputMode="numeric"
            autoComplete="off"
            placeholder={HOLD[part]}
            value={parts[part]}
            onChange={(e) => type(part, e.target.value)}
            onKeyDown={(e) => onKey(part, e)}
            onPaste={paste}
            onFocus={(e) => e.target.select()}
            className={`${part === 'y' ? 'w-12' : 'w-8'} bg-transparent text-center tabular-nums text-zebra-950 outline-none placeholder:text-zebra-400`}
          />
        </span>
      ))}
    </div>
  );
}

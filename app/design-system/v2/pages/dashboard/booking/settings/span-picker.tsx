'use client';

import { useState } from 'react';

import { InlineInput } from '@/components/ui-v2/inline-input';
import { ValueMenu } from '@/components/ui-v2/value-menu';

import { minutesOf, spanLabel, type Span, type Unit } from '../booking-data';
import { parseSpan } from '../span-text';

/**
 * What a time chip in a booking type's sheet opens: the v2 `ValueMenu`
 * (type to find, 2026-10-15), with one plain line on what the setting
 * does, a line to type any time the way people say it ("45 min",
 * "1 hr 30", "2 days", read by `parseSpan`), and a few quick picks under
 * it. A bare number lists itself in each unit ("9 min", "9 hrs",
 * "9 days"); Enter keeps the first. A "Custom…" row that turned into a
 * typing line, and an underlined field under the list, came before. `SpanField` is a typed field on the same soft fill, for the
 * breaks, which set two ends.
 *
 * @module app/design-system/v2/pages/dashboard/booking/settings/span-picker
 */

export interface SpanFieldProps {
  /** Names the field for screen readers: "Length". */
  label: string;
  value: Span;
  onChange: (span: Span) => void;
  /** The units it accepts, and the one a bare number means. */
  units: readonly Unit[];
  fallback: Unit;
  /** The lowest it takes; 1 unless a setting can be none (a break). */
  min?: number | undefined;
  /** Shown while empty: what to type. */
  placeholder: string;
}

/**
 * Any time, typed. It follows the value as soon as the text reads as a
 * time; leaving it with something it cannot read puts the last good
 * value back, and says so while it is wrong.
 */
export function SpanField({ label, value, onChange, units, fallback, min = 1, placeholder }: SpanFieldProps) {
  const [text, setText] = useState(spanLabel(value));
  const [bad, setBad] = useState(false);
  // A quick pick changes the value from outside: show it.
  const [seen, setSeen] = useState(minutesOf(value));
  if (seen !== minutesOf(value)) {
    setSeen(minutesOf(value));
    setText(spanLabel(value));
  }
  return (
    <span className="flex min-w-0 flex-1 flex-col items-end">
      <InlineInput
        aria-label={label}
        aria-invalid={bad || undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const s = parseSpan(e.target.value, units, fallback);
          const ok = s !== null && s.n >= min;
          setBad(e.target.value.trim() !== '' && !ok);
          // Noted as seen first, so our own change does not rewrite the text mid-typing.
          if (ok && s) {
            setSeen(minutesOf(s));
            onChange(s);
          }
        }}
        onBlur={() => (setText(spanLabel(value)), setBad(false))}
        className={`h-8 w-28 rounded-button bg-hover px-2 text-right type-body ${bad ? 'text-danger' : ''}`}
      />
    </span>
  );
}

export interface SpanPickerProps {
  label: string;
  /** What the setting does, in one line. */
  about: string;
  picks: readonly Span[];
  value: Span;
  units: readonly Unit[];
  fallback: Unit;
  placeholder: string;
  /** How a pick reads in the list. */
  show: (span: Span) => string;
  /** A quick pick (`done`, so the chip can close) or a typed change. */
  onChange: (span: Span, done: boolean) => void;
}

/** What typed text could mean: a bare number in each unit, else the one time it reads as. */
function readSpan(text: string, units: readonly Unit[], fallback: Unit): Span[] {
  const bare = /^\s*(\d+)\s*$/.exec(text);
  if (bare) return Number(bare[1]) >= 1 ? units.map((unit) => ({ n: Number(bare[1]), unit })) : [];
  const s = parseSpan(text, units, fallback);
  return s && s.n >= 1 ? [s] : [];
}

/** The picker. See the module comment. */
export function SpanPicker({ label, about, picks, value, units, fallback, placeholder, show, onChange }: SpanPickerProps) {
  return (
    <div className="w-80">
      <ValueMenu
        label={label}
        about={about}
        value={value}
        presets={picks}
        show={show}
        read={(t) => readSpan(t, units, fallback)}
        inputMode="text"
        placeholder={`Type a time, like ${placeholder}`}
        invalid="Not a time"
        onPick={(s) => onChange(s, true)}
      />
    </div>
  );
}

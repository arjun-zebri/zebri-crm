'use client';

import { useCallback, useRef, useState, type KeyboardEvent } from 'react';

import { MENU_ITEM } from './control-styles';
import { InlineInput } from './inline-input';
import { Popover, PopoverAnchor, PopoverContent } from './popover';

/**
 * Design system v2 time field (preview): a time of day typed or picked,
 * in a boxless line like {@link InlineInput}, for a run sheet's moments
 * or a booking's start. Focusing it drops a list of times in 15-minute
 * steps under it, scrolled to the current one, to click; the field keeps
 * focus, so typing works at the same time and is understood loosely:
 * "6", "630", "6.30", "6:30 pm", "18:30". A bare hour reads the way people
 * say it: with `after` (the moment before it on a sheet), the first
 * reading past that time, so "9" after 7:15 pm is 9:00 pm; alone, 1 to 6
 * is afternoon, 7 to 11 morning, 12 noon. Up and Down
 * nudge by a step, Enter keeps what was typed, and leaving the field
 * tidies it to "6:30 pm" or puts back the last good time.
 *
 * The value is the shown text ("6:30 pm"), empty when unset.
 * {@link parseTime} and {@link formatTime} are the same rules for callers
 * that sort or compare times.
 *
 * @example
 * ```tsx
 * <TimeField aria-label="Time of ceremony" value={time} onChange={setTime} className="w-20 type-body" />
 * ```
 *
 * @module components/ui-v2/time-field
 */

export interface TimeFieldProps {
  /** Required: a time field has no visible label. */
  'aria-label': string;
  /** "6:30 pm", or empty. */
  value: string;
  /** The tidied time, or empty; only when it changed. */
  onChange: (value: string) => void;
  placeholder?: string | undefined;
  /** Minutes between the listed times. */
  step?: number | undefined;
  /** A time this one follows, in minutes: settles am or pm for a bare hour. */
  after?: number | undefined;
  /** The secondary tone: a time worked out rather than set (one that follows on). */
  muted?: boolean | undefined;
  /** The type role and width of the line, as for `InlineInput`. */
  className?: string | undefined;
}

/**
 * Loose text to minutes after midnight, or null when it is not a time.
 * `after` settles a bare hour's am or pm: the first reading past it.
 */
export function parseTime(text: string, after?: number): number | null {
  const m = /^\s*(\d{1,2})(?:[:.]?(\d{2}))?\s*([ap])?\.?m?\.?\s*$/i.exec(text);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const half = m[3]?.toLowerCase();
  if (min > 59 || h > 23) return null;
  if (half) {
    if (h < 1 || h > 12) return null;
    if (half === 'p' && h < 12) h += 12;
    if (half === 'a' && h === 12) h = 0;
  } else if (h >= 1 && h <= 11) {
    // Said bare: the reading that follows the moment before, else 1 to 6
    // means the afternoon or evening and 7 to 11 the morning.
    if (after !== undefined) h = h * 60 + min > after ? h : h + 12;
    else if (h <= 6) h += 12;
  }
  return h * 60 + min;
}

/** Minutes after midnight as "6:30 pm" (the v2 time format, 2026-10-14). */
export function formatTime(minutes: number): string {
  const total = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const min = total % 60;
  return `${h % 12 || 12}:${String(min).padStart(2, '0')}${h < 12 ? ' am' : ' pm'}`;
}

// The list runs from early morning round to the small hours, since a
// reception can run past midnight; a sheet's sort treats 1:00 am as late.
const FIRST = 6 * 60;
const LAST = 26 * 60;

/** v2 time field. See {@link TimeFieldProps}. */
export function TimeField({ 'aria-label': label, value, onChange, placeholder = 'Time', step = 15, after, muted = false, className }: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const input = useRef<HTMLInputElement>(null);
  // A value set from outside (a sheet sorted, a draft reloaded) replaces
  // what was typed: the render-time reset React recommends over an effect.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }
  const current = parseTime(value);
  // As the list mounts (the popover opens): the current time in its
  // middle, without scrolling the page or dialog around it. A callback
  // ref, since the content mounts after `open` turns true.
  const showCurrent = useCallback((el: HTMLDivElement | null) => {
    const on = el?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (el && on) el.scrollTop = on.offsetTop - el.clientHeight / 2 + on.offsetHeight / 2;
  }, []);

  const commit = (text: string) => {
    const minutes = parseTime(text, after);
    const next = text.trim() === '' ? '' : minutes === null ? value : formatTime(minutes);
    setDraft(next);
    if (next !== value) onChange(next);
  };
  const pick = (minutes: number) => {
    commit(formatTime(minutes));
    setOpen(false);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const from = parseTime(draft, after) ?? after ?? 18 * 60;
      const to = from + (e.key === 'ArrowUp' ? -step : step);
      commit(formatTime(Math.round(to / step) * step));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commit(draft);
      setOpen(false);
    } else if (e.key === 'Escape' && open) {
      // Only the list closes: kept from the dialog around it, which would close too.
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  };

  const times: number[] = [];
  for (let t = FIRST; t < LAST; t += step) times.push(t % 1440);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <InlineInput
          ref={input}
          aria-label={label}
          placeholder={placeholder}
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => commit(draft)}
          onKeyDown={onKey}
          muted={muted}
          className={`tabular-nums${className ? ` ${className}` : ''}`}
        />
      </PopoverAnchor>
      <PopoverContent
        size="menu"
        align="start"
        aria-label={label}
        // The field keeps focus, so typing and the list work together.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (e.target === input.current) e.preventDefault();
        }}
      >
        <div ref={showCurrent} role="menu" className="max-h-56 overflow-y-auto">
          {times.map((t) => (
            <button
              key={t}
              type="button"
              role="menuitemradio"
              aria-checked={t === current}
              tabIndex={-1}
              onClick={() => pick(t)}
              className={`${MENU_ITEM} tabular-nums${t === current ? ' bg-pressed text-zebra-950' : ''}`}
            >
              {formatTime(t)}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

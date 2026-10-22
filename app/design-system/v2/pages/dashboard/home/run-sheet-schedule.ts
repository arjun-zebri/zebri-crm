import { formatTime } from '@/components/ui-v2/time-field';

import { minutesOf, type Moment } from './run-sheets';

/**
 * The night worked out: when each moment starts and ends. A moment with
 * its time set starts then; one without follows on from the end of the
 * one before. Where a set time leaves room after the moment before,
 * that is a gap; where it starts before the moment before has ended,
 * that is an overlap. On the night, minutes running late push every
 * moment not yet done.
 *
 * @module app/design-system/v2/pages/dashboard/home/run-sheet-schedule
 */

/** One moment's place in the night, in minutes after midnight. */
export interface Slot {
  start: number | null;
  end: number | null;
  /** Free minutes before it (a set time after the moment before ends). */
  gap: number;
  /** Minutes it starts before the moment before has ended. */
  overlap: number;
  /** Its time was set, rather than following on. */
  pinned: boolean;
}

/** When everything starts and ends. `late` pushes what is not done yet. */
export function schedule(moments: Moment[], late = 0): Slot[] {
  let prevEnd: number | null = null;
  return moments.map((m) => {
    const set = minutesOf(m.time, prevEnd ?? undefined);
    const base = set ?? prevEnd;
    const start = base === null ? null : base + (m.done ? 0 : late);
    const gap = set !== null && prevEnd !== null && set > prevEnd ? set - prevEnd : 0;
    const overlap = set !== null && prevEnd !== null && set < prevEnd ? prevEnd - set : 0;
    const end = base === null ? null : base + m.minutes;
    prevEnd = end ?? prevEnd;
    return {
      start,
      end: end === null ? null : end + (m.done ? 0 : late),
      gap,
      overlap,
      pinned: set !== null,
    };
  });
}

/** A slot's start as "6:30 pm", or empty. */
export const startText = (s: Slot | undefined) => (s?.start == null ? '' : formatTime(s.start));

/**
 * The moments with one moved to start at `start`, the way a calendar
 * moves an event: its time is set and it takes its place in the order
 * by that time, and nothing else moves. The moments that came straight
 * after it before and straight after it now are held at the times they
 * had, so neither closes up behind it nor slides after it; lengthening
 * a moment is what moves the ones that follow on.
 */
export function placeAt(moments: Moment[], id: string, start: number): Moment[] {
  const slots = schedule(moments);
  const held = moments.map((m, i) => ({ m, start: slots[i]?.start ?? null }));
  const from = held.findIndex((h) => h.m.id === id);
  const moved = held[from];
  if (!moved) return moments;
  const others = held.filter((h) => h.m.id !== id);
  const found = others.findIndex((h) => h.start !== null && h.start > start);
  const to = found < 0 ? others.length : found;
  // Its old follower now sits at index `from` of the others, its new one at `to`.
  const hold = (i: number) => {
    const h = others[i];
    if (h && !h.m.time && h.start !== null)
      others[i] = { ...h, m: { ...h.m, time: formatTime(h.start) } };
  };
  hold(from);
  hold(to);
  const rest = others.map((h) => h.m);
  return [...rest.slice(0, to), { ...moved.m, time: formatTime(start) }, ...rest.slice(to)];
}

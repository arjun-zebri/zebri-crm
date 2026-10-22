'use client';


import { PlusIcon } from '@/components/ui-v2/icons';
import { formatTime } from '@/components/ui-v2/time-field';

import type { EventFacts } from './run-sheet-demo';
import { PX } from './run-sheet-edges';
import { minutesOf } from './run-sheets';

/**
 * What the day is drawn on, under and over the blocks: the hours down
 * the left with a faint line across at each (`DayHours`), a thin named
 * line at a fixed point of the night such as sunset (`DayLine`), the
 * event's own three of those (`FactLines`), and the
 * faint block that shows where a click on empty time would add a 30
 * minute moment (`AddGhost`). Every position is minutes down the day
 * times `PX`, a value no class holds, so each sets its own top.
 *
 * @module app/design-system/v2/pages/dashboard/home/run-sheet-grid
 */

/** "3pm", "12am". */
const hourLabel = (minutes: number) => formatTime(minutes).replace(':00', '');

/** The hours from `from` to `to` (minutes after midnight, on the hour). */
export function DayHours({ from, to }: { from: number; to: number }) {
  const hours = Array.from({ length: (to - from) / 60 + 1 }, (_, i) => from + i * 60);
  return hours.map((h) => (
    // A zero-height row at the hour, so the label and its line centre on the same point.
    <div
      key={h}
      className="absolute inset-x-0 flex h-0 items-center gap-3"
      style={{ top: (h - from) * PX }}
    >
      <span className="w-11 text-right type-numeric text-zebra-400">{hourLabel(h)}</span>
      <span className="h-px flex-1 bg-hairline" />
    </div>
  ));
}

/** A thin line across the day at `at` minutes down, named at its right end. */
export function DayLine({
  at,
  line,
  text,
  label,
}: {
  at: number;
  line: string;
  text: string;
  label: string;
}) {
  return (
    // At its minute down the day (a value no class holds); above the blocks, but never in a click's way.
    <div className="pointer-events-none absolute left-14 right-0 z-20" style={{ top: at * PX }}>
      <div className={`h-px ${line}`} />
      <span className={`absolute -top-2.5 right-0 rounded-check bg-field px-1.5 type-body ${text}`}>
        {label}
      </span>
    </div>
  );
}

/** Where a click would add a moment: `at` minutes down the day, 30 minutes tall. */
export function AddGhost({ at, time }: { at: number; time: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 flex items-start gap-1.5 rounded-button bg-hover px-3 py-2 type-body text-zebra-400"
      style={{ top: at * PX + 1, height: 30 * PX - 2 }}
    >
      <PlusIcon aria-hidden="true" className="mt-0.5 size-4" />
      {time}
    </div>
  );
}

/**
 * The event's fixed points as lines: the ceremony (green, where the night
 * starts), sunset, and the venue closing (red once the night runs past it).
 */
export function FactLines({
  facts,
  from,
  over,
}: {
  facts: EventFacts;
  from: number;
  over: boolean;
}) {
  const lines = [
    { time: facts.ceremony, label: 'Ceremony', line: 'bg-grass-600/60', text: 'text-grass-700' },
    { time: facts.sunset, label: 'Sunset', line: 'bg-warning-ink/60', text: 'text-warning-ink' },
    {
      time: facts.finish,
      label: 'Venue closes',
      line: over ? 'bg-danger/70' : 'bg-zebra-400',
      text: over ? 'text-danger' : 'text-zebra-500',
    },
  ];
  return lines.map((l) => {
    const at = minutesOf(l.time);
    return at === null ? null : (
      <DayLine
        key={l.label}
        at={at - from}
        line={l.line}
        text={l.text}
        label={`${l.label} ${l.time}`}
      />
    );
  });
}

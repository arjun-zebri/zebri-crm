'use client';

import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { useId, useState, type MouseEvent } from 'react';

import { formatTime } from '@/components/ui-v2/time-field';

import { RunSheetBlock } from './run-sheet-block';
import type { EventFacts } from './run-sheet-demo';
import { PX, draggedBy, type Edge } from './run-sheet-edges';
import { AddGhost, DayHours, FactLines } from './run-sheet-grid';
import { placeAt, schedule } from './run-sheet-schedule';
import { minutesOf, newId, type Moment } from './run-sheets';

/**
 * The night as a day, the way a calendar draws one: the hours down the
 * left, each moment a block at its time as tall as it runs
 * (`RunSheetBlock`). The ceremony, sunset and the venue closing are thin
 * lines across the day at their times, named at the right end; on an
 * empty sheet the ceremony line is where the MC starts. Click an empty time
 * to add a 30 minute moment there (a faint block shows where, as the
 * pointer moves). Dragging a block moves just that moment (`placeAt`);
 * pulling its bottom edge changes its length, and what follows on from
 * it moves to suit. A block that starts before the one above it ends is
 * set in from the left, so both stay readable. An empty sheet shows the
 * afternoon and evening, ready for the first moment.
 *
 * @module app/design-system/v2/pages/dashboard/home/run-sheet-timeline
 */

export interface RunSheetTimelineProps {
  moments: Moment[];
  facts: EventFacts;
  selected: string | undefined;
  onSelect: (id: string) => void;
  onChange: (moments: Moment[]) => void;
}

const hour = (m: number, up = false) => (up ? Math.ceil(m / 60) : Math.floor(m / 60)) * 60;

/** The day. See {@link RunSheetTimelineProps}. */
export function RunSheetTimeline({
  moments,
  facts,
  selected,
  onSelect,
  onChange,
}: RunSheetTimelineProps) {
  // A few pixels before a drag starts, so a click still opens the moment.
  // A stable id for dnd-kit's screen reader ids, so a server render matches the browser's.
  const dndId = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  // The empty time the pointer is over, where a click would add a moment.
  const [ghost, setGhost] = useState<number | null>(null);
  const slots = schedule(moments);
  const ceremony = minutesOf(facts.ceremony);
  const finish = minutesOf(facts.finish);
  const starts = slots.flatMap((s) => (s.start === null ? [] : [s.start]));
  const ends = slots.flatMap((s) => (s.end === null ? [] : [s.end]));
  // An hour either side of the night, so there is room to add before and after it.
  // The ceremony counts as the night's start too, so its line is always in
  // view: an empty sheet opens an hour before it.
  const marks = ceremony === null ? starts : [...starts, ceremony];
  const first = marks.length ? Math.min(...marks) : 15 * 60;
  const from = Math.max(6 * 60, hour(first) - 60);
  const to = Math.max(
    starts.length ? hour(Math.max(...ends), true) + 60 : 24 * 60,
    finish === null ? 0 : hour(finish, true),
  );
  const over = finish !== null && Math.max(0, ...ends) > finish;
  // The quarter hour under the pointer, on the empty day only.
  const at = (e: MouseEvent<HTMLDivElement>) =>
    e.target === e.currentTarget
      ? from + Math.floor((e.clientY - e.currentTarget.getBoundingClientRect().top) / PX / 15) * 15
      : null;
  const add = (start: number) => {
    const fresh: Moment = {
      id: newId(),
      moment: '',
      time: formatTime(start),
      minutes: 30,
      cue: '',
      owner: '',
    };
    onChange(placeAt([...moments, fresh], fresh.id, start));
    onSelect(fresh.id);
    setGhost(null);
  };
  const resize = (i: number, edge: Edge, by: number) => {
    const m = moments[i];
    const start = slots[i]?.start;
    if (!m || start == null) return;
    if (edge === 'bottom') {
      onChange(moments.map((x) => (x.id === m.id ? { ...x, minutes: x.minutes + by } : x)));
      return;
    }
    // The top moves the start; the end stays where it was.
    const shorter = moments.map((x) => (x.id === m.id ? { ...x, minutes: x.minutes - by } : x));
    onChange(placeAt(shorter, m.id, start + by));
  };
  const drop = ({ active, delta }: DragEndEvent) => {
    const i = moments.findIndex((m) => m.id === active.id);
    const start = slots[i]?.start;
    const by = draggedBy(delta.y);
    onSelect(String(active.id));
    if (start != null && by) onChange(placeAt(moments, String(active.id), start + by));
  };
  return (
    <DndContext id={dndId} sensors={sensors} onDragEnd={drop}>
      {/* As tall as the day shown: a value no class holds. */}
      <div className="relative" style={{ height: (to - from) * PX }}>
        <DayHours from={from} to={to} />
        {/* The day itself: a click on empty time adds a moment there. */}
        <div
          role="presentation"
          className="absolute inset-y-0 left-14 right-0 z-10 cursor-pointer"
          onMouseMove={(e) => setGhost(at(e))}
          onMouseLeave={() => setGhost(null)}
          onClick={(e) => {
            const t = at(e);
            if (t !== null) add(t);
          }}
        >
          {ghost !== null ? <AddGhost at={ghost - from} time={formatTime(ghost)} /> : null}
          {moments.map((m, i) => {
            const s = slots[i];
            if (s?.start == null) return null;
            return (
              <RunSheetBlock
                key={m.id}
                moment={m}
                start={s.start}
                top={s.start - from}
                selected={m.id === selected}
                nested={s.overlap > 0}
                onSelect={() => onSelect(m.id)}
                onResize={(edge, by) => resize(i, edge, by)}
              />
            );
          })}
        </div>
        <FactLines facts={facts} from={from} over={over} />
      </div>
    </DndContext>
  );
}

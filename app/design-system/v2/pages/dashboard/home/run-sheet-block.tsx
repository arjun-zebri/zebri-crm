'use client';

import { useDraggable } from '@dnd-kit/core';
import type { CSSProperties } from 'react';

import { formatTime } from '@/components/ui-v2/time-field';

import {
  BLOCK_DEFAULT,
  BLOCK_TINT,
  PX,
  draggedBy,
  useEdgePull,
  type Edge,
} from './run-sheet-edges';
import type { Moment } from './run-sheets';

/**
 * One moment drawn on the day at its time, as tall as it runs, the way
 * a calendar draws an event: its name, then its time, who runs it and
 * where it stands.
 * One too short for two lines puts them on one. It takes the colour the
 * MC gave it. Click to open it beside the day; drag it up or down to
 * change when it starts. Pointed at, it shows a dot on its top and
 * bottom edges: pull the top to start it earlier or later (its end
 * stays put), the bottom to make it longer or shorter. Every move shows
 * the new time on the block as it happens, in steps of five minutes.
 *
 * @module app/design-system/v2/pages/dashboard/home/run-sheet-block
 */

export interface RunSheetBlockProps {
  moment: Moment;
  start: number;
  /** Minutes from the top of the day. */
  top: number;
  selected: boolean;
  /** Starts before the moment above it ends: set in from the left. */
  nested: boolean;
  onSelect: () => void;
  /** An edge pulled by `by` minutes (top: the new start minus the old; bottom: the change in length). */
  onResize: (edge: Edge, by: number) => void;
}

// The edge dots wait for the block to be pointed at; touch screens always show them.
const ON_HOVER =
  'transition-opacity duration-150 motion-reduce:transition-none pointer-fine:opacity-0 pointer-fine:group-hover/block:opacity-100';

/** One block. See {@link RunSheetBlockProps}. */
export function RunSheetBlock({
  moment: m,
  start,
  top,
  selected,
  nested,
  onSelect,
  onResize,
}: RunSheetBlockProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: m.id });
  const { pulling, shift, minutes, grab } = useEdgePull(m.minutes, onResize);
  const shown = formatTime(start + shift + draggedBy(transform?.y ?? 0));
  const height = Math.max(minutes * PX - 2, 20);
  const sub = [shown, m.owner, m.status].filter(Boolean).join(' · ');
  const name = m.moment || 'New moment';
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      aria-label={`${name}, ${sub}`}
      aria-pressed={selected}
      onClick={(e) => {
        // Not a click on the empty day behind it, which adds a moment.
        e.stopPropagation();
        onSelect();
      }}
      // Dragging is the pointer's; from the keyboard, Enter or Space opens it.
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      // Where it sits and how tall it is come from its time and length, and
      // a drag moves it by a transform worked out each frame: values no
      // class can hold, so this is the one inline style on the day.
      style={{
        top: (top + shift) * PX + 1,
        height,
        transform: transform ? `translateY(${transform.y}px)` : undefined,
      }}
      className={`group/block absolute right-0 cursor-pointer rounded-button bg-field text-zebra-950 focus-mark ${
        nested ? 'left-1/3 ring-2 ring-field' : 'left-0'
      } ${selected ? 'z-10 ring-2 ring-selected' : nested ? 'z-[5]' : ''} ${isDragging || pulling ? 'z-20 shadow-lg' : ''}`}
    >
      {/* The tint sits on a solid layer, so the hour lines stop at the block's edge. */}
      <span
        aria-hidden="true"
        // The picked colour, which the tint class mixes into the page white.
        style={{ '--block': m.color ?? BLOCK_DEFAULT } as CSSProperties}
        className={`pointer-events-none absolute inset-0 rounded-button transition-colors duration-150 motion-reduce:transition-none ${BLOCK_TINT}`}
      />
      <div
        className={`relative h-full overflow-hidden px-3 ${height >= 44 ? 'py-2' : 'flex items-center'}`}
      >
        {height >= 44 ? (
          <>
            <p className="truncate type-label">{name}</p>
            <p className="truncate type-body text-zebra-500">{sub}</p>
          </>
        ) : (
          <p className="flex min-w-0 items-center gap-2">
            <span className="truncate type-label">{name}</span>
            <span className="shrink-0 type-body text-zebra-500">{shown}</span>
          </p>
        )}
      </div>
      {(['top', 'bottom'] as const).map((edge) => (
        <span
          key={edge}
          aria-hidden="true"
          {...grab(edge)}
          onClick={(e) => e.stopPropagation()}
          // A wide grab area round a small dot, centred on the edge.
          className={`absolute left-1/2 z-10 flex h-4 w-10 -translate-x-1/2 cursor-ns-resize touch-none items-center justify-center ${
            edge === 'top' ? '-top-2' : '-bottom-2'
          } ${pulling === edge ? '' : ON_HOVER}`}
        >
          <span className="size-2.5 rounded-pill bg-field ring-1 ring-zebra-400" />
        </span>
      ))}
    </div>
  );
}

'use client';

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useId } from 'react';

import { AddStepMenu } from './add-step-menu';
import { JourneyStep } from './journey-step';
import type { Journey, JourneyStep as Step } from './journeys-data';
import { lineWhen, outOfOrder, waitOf } from './line-rules';
import { useLineReveal } from './use-line-reveal';

/**
 * A journey's steps on one vertical line, timing beside it like times in
 * a schedule (the event's date beside the event), each card showing its
 * follow-ups and a dot for who it waits on. Steps drag to a new place by the grip
 * on hover, and a + on the line under any step adds one there; the
 * line's last slot (a circle and Add a step) adds one before the
 * event. Opening the day marker lists the couples at it.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/journey-path
 */

/** A client shown on the line: their avatars, on the step that is next for them. */
export interface Visitor {
  step: string;
  names: [string, string];
  /** Where they stand on it, beside their avatars: "Sent by Zebri", "Paid $600". */
  status?: string | undefined;
  /** The one thing the MC does for them here, as a button on the card ("Sign"). */
  action?: { label: string; onClick: () => void } | undefined;
  /** Their avatars on the card; false shows only the status (the first run's booked couple). */
  avatars?: boolean | undefined;
  /** The steps above theirs are done for them: drawn ticked. */
  passed?: boolean | undefined;
}

export interface JourneyPathProps {
  journey: Journey;
  /** Clients to show on their step (the first run's test client); the line itself does not draw `journey.people`. */
  visitors?: Visitor[] | undefined;
  /** A `data-tour` on the line, for a spotlight to ring it. */
  tour?: string | undefined;
  /** Plays the line in once (`useLineReveal`): done steps tick off, then the rest rise in. */
  reveal?: boolean | undefined;
  onOpen: (step: Step) => void;
  onReorder: (ids: string[]) => void;
  /** Adds `step` at `at`, or before the day when `at` is left out. */
  onAdd: (step: Step, at?: number) => void;
}

/** The line. See {@link JourneyPathProps}. */
export function JourneyPath({ journey, visitors, tour, reveal = false, onOpen, onReorder, onAdd }: JourneyPathProps) {
  // A stable id for dnd-kit's screen reader ids: its own counter differs between the server render and the browser's.
  const dndId = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const { steps } = journey;
  const ids = steps.map((s) => s.id);
  const late = outOfOrder(steps);
  const waits = steps.map((s, i) => waitOf(s, steps[i - 1]));
  // Everything above a passed client's step is done for them; the day is never "done" ahead of it.
  const passed = visitors?.find((v) => v.passed);
  const doneCount = Math.max(0, passed ? steps.findIndex((s) => s.id === passed.step) : 0);
  const played = useLineReveal(reveal, steps.length, doneCount);
  const ticked = (i: number) => i < doneCount && played > i;
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  };
  return (
    <div className="space-y-4">
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ol aria-label={`${journey.name} steps`} data-tour={tour} className="space-y-3">
            {steps.map((s, i) => (
              <JourneyStep
                key={s.id}
                step={s}
                when={lineWhen(journey, i)}
                here={visitors?.find((v) => v.step === s.id)}
                outOfOrder={late.has(s.id)}
                done={ticked(i)}
                lineDone={{ above: ticked(i) && ticked(i - 1), below: ticked(i) && ticked(i + 1) }}
                waiting={i >= doneCount && played <= i}
                rising={reveal && i >= doneCount && played > i}
                waits={waits[i]!}
                first={i === 0}
                last={false}
                onOpen={() => onOpen(s)}
                // None under the last step: the Add a step slot is right there.
                after={i < steps.length - 1 ? <AddStepMenu onLine onAdd={(n) => onAdd(n, i + 1)} /> : null}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {/* The line's last slot: the line runs on into a circle, and the whole row adds a step before the day. */}
      <div
        className={`relative grid grid-cols-[9rem_2.5rem_minmax(0,1fr)] items-center gap-x-4 ${played <= steps.length ? 'opacity-0' : reveal ? 'motion-safe:animate-line-rise' : ''}`}
      >
        <span aria-hidden="true" className="absolute -top-4 left-[calc(9rem+1rem+1.25rem)] h-4 w-px -translate-x-1/2 bg-zebra-200" />
        <div className="col-span-2 col-start-2">
          <AddStepMenu onAdd={(n) => onAdd(n)} />
        </div>
      </div>
    </div>
  );
}

'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { HOVER_ON_WHITE } from '@/components/ui-v2/control-styles';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { ArrowRightIcon, DragIcon, NotificationsIcon } from '@/components/ui-v2/icons';
import { Panel } from '@/components/ui-v2/panel';
import { StretchedButton } from '@/components/ui-v2/stretched-button';

import { ClientAvatars } from '../clients/client-parts';

import type { Visitor } from './journey-path';
import { STEP_ICON, STEP_TONE, titleOf, type JourneyStep as Step } from './journeys-data';
import { WAIT_DOT, WAIT_LABEL, type WaitsOn } from './line-rules';

/**
 * One step on the journey's line, read left to right like a schedule:
 * when it goes out (beside the line, like a time; amber when its date
 * puts it before a step above it), its glyph on the line in its family's
 * tint, then the card: what it sends, a bell with how many follow-ups it
 * has, and a dot for who it waits on (green Automatic, hollow Waits on
 * client, amber Needs you; the legend is by the pills). The whole card
 * opens the step.
 *
 * The line is drawn per step, in two halves, so it runs through every
 * glyph and across the gaps between cards. Hovering
 * a card shows its grip (steps drag to a new place, no edit mode) and,
 * on the line under it, a + to add a step there (`after`).
 *
 * The event day is a tinted marker, never moved.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/journey-step
 */

export interface JourneyStepProps {
  step: Step;
  /** When it goes out, in a few words beside the line: "Once signed", "8 weeks before". */
  when: string;
  /** A client this step is next for, shown on the card (the first run's test couples), with where they stand and the MC's one move. */
  here?: Visitor | undefined;
  /** Its date puts it before a step drawn above it. */
  outOfOrder: boolean;
  /** Done for the client shown on the line: the glyph becomes a tick, the card steps back. */
  done?: boolean | undefined;
  /** The line into it from above, and out of it below, runs between two done steps: drawn in green. */
  lineDone?: { above: boolean; below: boolean } | undefined;
  /** Not yet played in (`useLineReveal`): held back, to rise in on its turn. */
  waiting?: boolean | undefined;
  /** Its turn has come in a reveal: it settles onto the line (`line-rise`). */
  rising?: boolean | undefined;
  /** Who this step waits on: the dot on the card's right, read by the page's legend. */
  waits: WaitsOn;
  first: boolean;
  last: boolean;
  /** The + under it on the line. */
  after: ReactNode;
  onOpen: () => void;
}

/** The card: the day's tinted, every other step a panel. */
function Card({ day, dragging, children }: { day: boolean; dragging: boolean; children: ReactNode }) {
  if (day) return <div className="relative rounded-panel bg-grass-50 ring-1 ring-grass-200">{children}</div>;
  // Lifted while dragged: a panel floating alone is `raised`.
  return <Panel raised={dragging} className={`relative transition-[background-image,box-shadow] duration-150 ${HOVER_ON_WHITE} motion-reduce:transition-none`}>{children}</Panel>;
}

/** A step. See {@link JourneyStepProps}. */
export function JourneyStep({ step, when, here, outOfOrder, done = false, lineDone, waiting = false, rising = false, waits, first, last, after, onOpen }: JourneyStepProps) {
  const day = step.kind === 'day';
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id, disabled: day });
  const Icon = STEP_ICON[step.kind];
  const title = titleOf(step);
  const words = (
    <span className={`block truncate ${day ? 'text-grass-800' : 'text-zebra-950'}`}>
      <span className="type-label">{title.name}</span>{' '}
      {title.detail ? <span className={day ? 'text-grass-700' : 'text-zebra-500'}>{title.detail}</span> : null}
    </span>
  );
  return (
    <li
      ref={setNodeRef}
      // Where the drag has carried it, measured by dnd-kit as it moves.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group relative grid grid-cols-[9rem_2.5rem_minmax(0,1fr)] items-center gap-x-4 ${waiting ? 'opacity-0' : rising ? 'motion-safe:animate-line-rise' : ''} ${isDragging ? 'z-20' : ''}`}
    >
      <span className={`text-right type-body ${outOfOrder ? 'text-warning-ink' : day ? 'text-grass-700' : 'text-zebra-500'}`}>
        {when}
        {outOfOrder ? <span className="block">Out of order</span> : null}
      </span>
      <span className="relative flex h-full items-center justify-center self-stretch">
        {first ? null : <span aria-hidden="true" className={`absolute top-0 left-1/2 h-1/2 w-px -translate-x-1/2 transition-colors duration-[900ms] motion-reduce:transition-none ${lineDone?.above ? 'bg-grass-400' : 'bg-zebra-200'}`} />}
        {last ? null : <span aria-hidden="true" className={`absolute top-1/2 -bottom-3 left-1/2 w-px -translate-x-1/2 transition-colors duration-[900ms] motion-reduce:transition-none ${lineDone?.below ? 'bg-grass-400' : 'bg-zebra-200'}`} />}
        {done ? (
          // Ticked off: the glyph gives way to a tick that draws itself (DrawnCheck mounts as it turns), with a slight spring.
          <span className="relative flex size-10 items-center justify-center rounded-pill bg-grass-500 text-zebra-50 motion-safe:animate-swap-in">
            <DrawnCheck className="size-4" />
            <span className="sr-only">Done</span>
          </span>
        ) : (
          <span aria-hidden="true" className={`relative flex size-10 items-center justify-center rounded-pill ${STEP_TONE[step.kind]}`}>
            <Icon className="size-4" />
          </span>
        )}
        {after}
      </span>
      {/* A done step steps back as it ticks, so what is still to come carries the page. */}
      <div className={`min-w-0 transition-opacity duration-[900ms] ease-out motion-reduce:transition-none ${done ? 'opacity-50' : 'opacity-100'}`}>
      <Card day={day} dragging={isDragging}>
        <div className="relative flex min-h-16 items-center gap-3 py-3 pr-4 pl-6">
          {day ? null : (
            <button
              type="button"
              aria-label={`Drag to move ${step.name}`}
              {...attributes}
              {...listeners}
              className="absolute top-1/2 left-0.5 z-10 flex size-5 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-button text-zebra-400 opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-zebra-950 focus-key:opacity-100 focus-mark active:cursor-grabbing motion-reduce:transition-none"
            >
              <DragIcon aria-hidden="true" className="size-4" />
            </button>
          )}
          <div className="min-w-0 flex-1 type-body">
            {/* The event is a marker, not a step: nothing to open. */}
            {day ? (
              words
            ) : (
              <StretchedButton onClick={onOpen} radius="panel" label={`${step.name}: ${step.detail}, ${when}`}>
                {words}
              </StretchedButton>
            )}
          </div>
          {here ? (
            // Who is here, so the line reads as a place a client is at, not just a list of steps.
            <span className="flex shrink-0 items-center gap-2 type-body text-zebra-500">
              {here.avatars === false ? null : <ClientAvatars client={{ names: here.names }} />}
              <span className="sr-only">{`${here.names.filter(Boolean).join(' & ')} are here`}</span>
              {here.status ? <span aria-live="polite">{here.status}</span> : null}
            </span>
          ) : null}
          {here?.action ? (
            // Above the card's own button, so a click is the move, not opening the step.
            <span className="relative z-10 shrink-0">
              <Button onClick={here.action.onClick}>{here.action.label}</Button>
            </span>
          ) : null}
          {step.reminders.length ? (
            <span className="flex shrink-0 items-center gap-1 type-numeric text-zebra-500">
              <NotificationsIcon aria-hidden="true" className="size-4" />
              <span className="sr-only">Follow-ups:</span>
              {step.reminders.length}
            </span>
          ) : null}
          {day ? null : (
            <span role="img" aria-label={WAIT_LABEL[waits]} className={`size-2.5 shrink-0 rounded-pill ${WAIT_DOT[waits]}`} />
          )}
          {day ? null : <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0 text-zebra-400" />}
        </div>
      </Card>
      </div>
    </li>
  );
}

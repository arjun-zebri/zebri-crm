'use client';

import { useState } from 'react';

import { RowSections } from '@/components/ui-v2/row-sections';

import type { Journey } from './journeys-data';
import { emailOf, filled, reminderOf } from './step-email';
import { QUEUE_SECTIONS, groupOf, waitsOnYou, type QueueItem } from './up-next-data';
import { UpNextReview, type Draft } from './up-next-review';
import { ApproveRow, TodoRow } from './up-next-rows';
import { ScheduledRow, type ScheduledMove } from './up-next-scheduled';
import type { UpNextState } from './use-up-next';

/**
 * Journeys' Up next pill: what the journeys are about to do, in
 * sections by what needs the MC. Needs you first (sends held for an OK,
 * the MC's own to-dos, a late one in red), then what Zebri sends by
 * itself today and later, with Done folded away. Nothing sends straight
 * from a row: Send opens the message to read first. Empty sections do
 * not show, and a line says so when nothing needs the MC at all.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/up-next-view
 */

/** The message a queued send goes out with: its own draft, else its step's email (or the follow-up's), filled in for this client. */
function draftFor(item: QueueItem, journey: Journey | undefined): Draft {
  if (item.draft) return item.draft;
  const at = journey?.steps.findIndex((s) => s.id === item.step) ?? -1;
  const step = journey?.steps[at];
  if (!step) return { subject: item.label, body: '' };
  const next = journey?.steps[at + 1];
  const e = item.reminder ? reminderOf(step, item.reminder, next) : emailOf(step, next);
  const fill = (t: string) => filled(t.replace(/\{first names\}/g, item.names.join(' and ')));
  return { subject: fill(e.subject), body: fill(e.body) };
}

export interface UpNextViewProps {
  state: UpNextState;
  journeys: Journey[];
  /** Opens a step on its journey: the ⋯ menu's Open the step. */
  onOpenStep: (journey: string, step: string) => void;
}

/** The Up next view. See {@link UpNextViewProps}. */
export function UpNextView({ state, journeys, onOpenStep }: UpNextViewProps) {
  const [reading, setReading] = useState<string | null>(null);
  const item = state.queue.find((i) => i.id === reading) ?? null;
  const journeyOf = (i: QueueItem) => journeys.find((j) => j.id === i.journey);
  const nameOf = (i: QueueItem) => journeyOf(i)?.name ?? 'A journey';
  const calm = !state.queue.some(waitsOnYou);

  const move = (i: QueueItem, m: ScheduledMove) => {
    if (m === 'read' || m === 'send') setReading(i.id);
    else if (m === 'skip') state.settle(i.id, 'Skipped by you');
    else if (m === 'pause') state.settle(i.id, `Paused for ${i.names.join(' & ')}`);
    else onOpenStep(i.journey, i.step);
  };

  return (
    <>
      {calm ? (
        <p className="px-3 type-lead text-zebra-500">Nothing needs you. Zebri has the rest.</p>
      ) : null}
      <RowSections
        sections={QUEUE_SECTIONS}
        items={state.queue}
        sectionOf={groupOf}
        renderRow={(i) => {
          if (i.section === 'approve')
            return (
              <ApproveRow
                key={i.id}
                item={i}
                journey={nameOf(i)}
                sending={state.sending.has(i.id)}
                onOpen={() => setReading(i.id)}
              />
            );
          if (i.section === 'todo')
            return (
              <TodoRow
                key={i.id}
                item={i}
                journey={nameOf(i)}
                onTick={() => state.settle(i.id, 'Done by you')}
                onUndo={() => state.reopen(i.id)}
              />
            );
          return (
            <ScheduledRow key={i.id} item={i} journey={nameOf(i)} onMove={(m) => move(i, m)} />
          );
        }}
      />
      <UpNextReview
        key={reading ?? 'none'}
        item={item}
        journey={item ? journeyOf(item) : undefined}
        draft={item ? draftFor(item, journeyOf(item)) : null}
        sending={item ? state.sending.has(item.id) : false}
        onClose={() => setReading(null)}
        onSkip={() => {
          if (item) state.settle(item.id, 'Skipped by you');
          setReading(null);
        }}
        onSend={(d) => {
          if (!item) return;
          state.send(item.id, d);
          window.setTimeout(() => setReading(null), 700);
        }}
      />
    </>
  );
}

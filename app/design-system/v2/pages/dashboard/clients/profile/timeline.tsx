'use client';

import { Button } from '@/components/ui-v2/button';

import type { EventInfo, Task, Tone, Upcoming } from './profile-data';

/**
 * The Overview's timeline, from today to the event: dates in a column on
 * the left, one line through the dots, and the event pinned at the
 * bottom as where it all leads. Today holds what needs the MC, each as a
 * card with where it stands and the one button that does it (overdue in
 * red, waiting on someone in amber). The dates between are quiet lines;
 * the ones Zebri sends on its own say so in green, with a green ring.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/timeline
 */

// Amber status text uses `text-warning-ink`: the warning token alone is too light to read on white.
const CARD: Record<Tone, { card: string; dot: string; status: string }> = {
  danger: { card: 'border-danger/25 bg-danger/5', dot: 'bg-danger', status: 'text-danger' },
  warning: { card: 'border-zebra-200 bg-field', dot: 'bg-warning', status: 'text-warning-ink' },
};

// Columns: the date, the dot, what it is; narrower on phones so the
// cards keep room. The line runs down the middle of the dot column:
// 3rem + 0.75rem gap + half of 1.25rem on phones, 4.5rem + 1rem + half
// of 1.5rem from sm.
const ROW =
  'grid grid-cols-[3rem_1.25rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[4.5rem_1.5rem_minmax(0,1fr)] sm:gap-x-4';

export interface TimelineProps {
  tasks: Task[];
  upcoming: Upcoming[];
  event: EventInfo;
  /** "in 15 days", or empty before the event is near. */
  countdown: string;
  onTask: (task: Task) => void;
}

/** The timeline. See {@link TimelineProps}. */
export function Timeline({ tasks, upcoming, event, countdown, onTask }: TimelineProps) {
  return (
    <ol aria-label="Timeline" className="relative flex min-h-full flex-col">
      {/* Positioned, so it would paint over the dots; each dot is made
          relative too, and coming later in the source, paints on top. */}
      <span
        aria-hidden="true"
        className="absolute bottom-5 left-[4.375rem] top-6 sm:left-[6.25rem] w-px -translate-x-1/2 bg-zebra-200"
      />
      <li className={`${ROW} items-start pb-6`}>
        <span className="pt-4 text-right type-label text-zebra-950">Today</span>
        <span className="flex justify-center pt-[1.125rem]">
          <span
            aria-hidden="true"
            className="relative size-3 rounded-pill bg-zebra-950 ring-4 ring-field"
          />
        </span>
        <div className="space-y-3">
          {tasks.length ? (
            tasks.map((t) => <TaskCard key={t.id} task={t} onTask={onTask} />)
          ) : (
            <p className="pt-4 type-body text-zebra-500">Nothing needs you today.</p>
          )}
        </div>
      </li>
      {upcoming.map((u) => (
        <li key={u.id} className={`${ROW} items-center py-3.5`}>
          <span className="text-right type-body text-zebra-400">{u.when}</span>
          <span className="flex justify-center">
            <span
              aria-hidden="true"
              className={`relative size-3.5 rounded-pill border-2 bg-field ${u.zebri ? 'border-grass-500' : 'border-zebra-300'}`}
            />
          </span>
          <p className="type-body text-zebra-950">
            {u.label}
            {u.zebri ? <span className="ml-2 text-grass-600">Zebri sends</span> : null}
          </p>
        </li>
      ))}
      {/* mt-auto pins the event to the bottom however few dates come before it. */}
      <li className={`${ROW} mt-auto items-center pt-10`}>
        <span className="text-right type-label text-zebra-950">{event.day}</span>
        <span className="flex justify-center">
          <span
            aria-hidden="true"
            className="relative size-4 rounded-pill bg-grass-500 ring-4 ring-grass-100"
          />
        </span>
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span className="type-heading text-zebra-950">
            {[event.type, event.time].filter(Boolean).join(' · ')}
          </span>
          {countdown ? <span className="type-body text-zebra-500">{countdown}</span> : null}
        </p>
      </li>
    </ol>
  );
}

function TaskCard({ task, onTask }: { task: Task; onTask: (t: Task) => void }) {
  const tone = CARD[task.tone];
  return (
    // On a narrow screen the button drops under the text rather than
    // squeezing it to a word a line.
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-3 rounded-panel border px-4 py-4 sm:px-5 ${tone.card}`}
    >
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-pill ${tone.dot}`} />
      <div className="min-w-40 flex-1 type-body">
        <p className="type-label text-zebra-950">{task.label}</p>
        <p className={tone.status}>{task.status}</p>
      </div>
      {/* Only an overdue task gets the filled button: one loud thing at a time. */}
      <Button
        variant={task.tone === 'danger' ? 'primary' : 'secondary'}
        onClick={() => onTask(task)}
      >
        {task.cta}
      </Button>
    </div>
  );
}

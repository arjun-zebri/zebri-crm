'use client';

import { CheckIcon } from '@/components/ui-v2/icons';

/**
 * The three steps a couple's paperwork goes through, across the top of
 * the paperwork dialog: Couple's details, Before the day, Lodge. Done
 * steps carry a tick, the current one is dark, the rest wait in grey.
 * A done or current step can be clicked to look back at it; one still
 * to come cannot, since there is nothing in it yet.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/step-tracker
 */

export interface StepTrackerProps {
  /** Each step's words, the Lodge step with its date. */
  labels: string[];
  /** The step it is on. */
  current: number;
  /** Every step is finished (registered). */
  finished: boolean;
  /** The step on screen. */
  viewing: number;
  onView: (step: number) => void;
}

/** The tracker. See {@link StepTrackerProps}. */
export function StepTracker({ labels, current, finished, viewing, onView }: StepTrackerProps) {
  return (
    <ol aria-label="Steps" className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {labels.map((label, i) => {
        const done = i < current || finished;
        const reachable = i <= current;
        return (
          <li key={label}>
            <button
              type="button"
              disabled={!reachable}
              aria-current={i === viewing ? 'step' : undefined}
              onClick={() => onView(i)}
              className={`flex items-center gap-2 rounded-button py-1 transition-colors duration-150 focus-mark disabled:cursor-default motion-reduce:transition-none ${
                i === viewing ? 'type-label text-zebra-950' : reachable ? 'type-body text-zebra-600 hover:text-zebra-950' : 'type-body text-zebra-400'
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex size-5 items-center justify-center rounded-pill type-label ${
                  done ? 'bg-grass-800 text-zebra-50' : i === current ? 'bg-zebra-950 text-zebra-50' : 'bg-zebra-100 text-zebra-500'
                }`}
              >
                {done ? <CheckIcon className="size-3.5" /> : i + 1}
              </span>
              {label}
              {done ? <span className="sr-only">, done</span> : null}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

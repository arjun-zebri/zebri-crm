import { Badge } from '@/components/ui-v2/badge';
import { ROW } from '@/components/ui-v2/control-styles';
import { IconCircle } from '@/components/ui-v2/icon-circle';
import { CheckIcon, type ZebriIcon } from '@/components/ui-v2/icons';
import { StretchedButton } from '@/components/ui-v2/stretched-button';

/**
 * One step of the Journeys band, set straight on the gradient: what it
 * sends and what sets it off ("When they accept"), and for the step on
 * the stage, a line on what it does, in a white card lifted off the
 * gradient, as a premium feature list marks its open item (founder,
 * 2026-10-18: the steps out of their container, "more detailed").
 *
 * The rail between steps is the clock: once a step is done, the line to
 * the next draws down over the pause before the next tick (`timer`), so
 * the next step ticks as the line reaches it. A done step with something
 * to show can be clicked to put it back on the stage.
 *
 * @module app/design-system/v2/pages/website/journey-step
 */

/** What a step row says: shared by the Journeys band and the BDM lodgement band. */
export interface StepCopy {
  icon: ZebriIcon;
  name: string;
  /** What sets it off, or how: "When they accept". */
  when: string;
  /** What it does, in a sentence, shown while it is on the stage. */
  detail: string;
  /** What it says once it has happened: "Signed". */
  done: string;
}

/** A step of the Journeys band's journey: its row, and its stage's foot line. */
export interface ShotStep extends StepCopy {
  /** What just happened, as the stage's footer says it: "Signed by Jess, Mia and Leo". */
  event: string;
  /** When it happened, beside the footer's line: "Wed 9 Sep". */
  at: string;
}

/** Every change eases over the same half second, so a tick reads as one movement. */
export const EASE = 'transition duration-500 ease-out motion-reduce:transition-none';
/** Two things in one grid cell, so one can fade out as the other fades in without the row moving. */
export const STACK = 'col-start-1 row-start-1';

/** The pause between ticks: long enough to take in each document. `LINE.timer` draws over the same 2600ms. */
export const STEP_MS = 2600;

/** How the line to the next step is drawn: not yet, drawing as the clock to the next tick, or drawn. */
export type Line = 'empty' | 'timer' | 'full';

interface JourneyStepProps {
  step: StepCopy;
  /** Has happened: ticked and badged. */
  done: boolean;
  /** Is the one on the stage: lifted, with its detail. */
  lit: boolean;
  /** Shows its detail: the lit step, or the first before anything has happened. */
  open: boolean;
  /** The line to the next step; none for the last. */
  line: Line | null;
  /** Puts this step on the stage; only for a done step with a scene. */
  onShow?: (() => void) | undefined;
}

const LINE = {
  empty: `scale-y-0 ${EASE}`,
  timer: 'scale-y-100 transition-transform duration-[2600ms] ease-linear motion-reduce:transition-none',
  full: `scale-y-100 ${EASE}`,
} as const;

/** One step. See {@link JourneyStepProps}. */
export function JourneyStep({ step, done, lit, open, line, onShow }: JourneyStepProps) {
  const name = <span className="type-label text-zebra-950">{step.name}</span>;
  return (
    <li
      aria-current={lit ? 'step' : undefined}
      className={`relative flex gap-4 rounded-panel p-4 ${EASE} ${onShow && !lit ? ROW : ''} ${lit ? 'bg-field shadow-lg ring-1 ring-hairline' : ''}`}
    >
      {/* The line from this circle's foot (48px down) to the next circle (16px into the next
          row, past the 4px gap). */}
      {line ? (
        <span className="absolute -bottom-5 left-8 top-12 w-px -translate-x-1/2 bg-zebra-950/10">
          <span
            className={`absolute inset-0 origin-top bg-grass-500 ${LINE[line]}`}
          />
        </span>
      ) : null}
      <IconCircle tone={done ? 'grass' : 'neutral'} className={`relative bg-field ${EASE}`}>
        <span className="grid place-items-center">
          <step.icon
            aria-hidden="true"
            className={`${STACK} size-4 ${EASE} ${done ? 'scale-75 opacity-0' : 'scale-100 opacity-100'}`}
          />
          <CheckIcon aria-hidden="true" className={`${STACK} size-4 draw-check ${done ? 'draw-check-on' : ''}`} />
        </span>
      </IconCircle>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {onShow ? (
              <StretchedButton label={`Show the ${step.name.toLowerCase()}`} onClick={onShow} radius="panel">
                {name}
              </StretchedButton>
            ) : (
              <p>{name}</p>
            )}
            <p className="type-body text-zebra-500">{step.when}</p>
          </div>
          <Badge tone="grass" className={`shrink-0 ${EASE} ${done ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'}`}>
            {step.done}
          </Badge>
        </div>
        {/* Opens by its height (0fr to 1fr). One step is always open, so the list keeps its height. */}
        <div
          className={`grid transition-[grid-template-rows] duration-500 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        >
          <p className={`min-h-0 overflow-hidden type-body text-zebra-600 ${EASE} ${open ? 'opacity-100' : 'opacity-0'}`}>
            <span className="block pt-2">{step.detail}</span>
          </p>
        </div>
      </div>
    </li>
  );
}

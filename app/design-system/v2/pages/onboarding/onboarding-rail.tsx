import Image from 'next/image';

import { STEPS, TOTAL_STEPS, timeLeftLabel } from './steps-meta';

/**
 * Onboarding step rail: the Zebri wordmark, every step on a connected
 * line with a done / current / upcoming marker, and a progress bar with
 * the time left at the foot. Hidden below `md`, where the slim header
 * carries the progress bar instead. Not clickable, by design: steps are
 * taken in order.
 *
 * @module app/design-system/v2/pages/onboarding/onboarding-rail
 */
export function OnboardingRail({ step }: { step: number }) {
  return (
    <nav aria-label="Setup steps" className="hidden w-64 shrink-0 flex-col border-r border-zebra-200 bg-zebra-50 px-5 py-7 md:flex">
      <div className="flex items-center gap-3 px-2">
        {/* The wordmark SVG has a white box baked in; multiply drops it out. */}
        <Image src="/zebri-logo.svg" alt="Zebri" width={67} height={24} className="h-6 w-auto mix-blend-multiply" />
        <span aria-hidden="true" className="h-4 w-px bg-zebra-300" />
        <span className="type-body text-zebra-500">Setup</span>
      </div>
      <ol className="mt-10 space-y-2">
        {STEPS.map((s, i) => {
          const n = i + 1;
          const state = n < step ? 'done' : n === step ? 'current' : 'upcoming';
          return (
            <li
              key={s.railLabel}
              aria-current={state === 'current' ? 'step' : undefined}
              className={`relative flex items-center gap-3 rounded-button px-2 py-2 type-body ${
                state === 'current' ? 'bg-field font-medium text-zebra-950 shadow-sm' : state === 'done' ? 'text-zebra-950' : 'text-zebra-500'
              }`}
            >
              {/* The line down to the next marker: from this circle's foot
                  (32px down) across the 8px gap and the next item's 8px
                  top padding. The current step's white card must stay
                  clean, so its line starts at the card's edge instead;
                  the line from the step above runs under the card, which
                  comes later in the page and paints over it. */}
              {n < TOTAL_STEPS ? (
                <span
                  aria-hidden="true"
                  className={`absolute left-5 w-px -translate-x-1/2 ${state === 'current' ? 'top-full h-4' : 'top-8 h-6'} ${state === 'done' ? 'bg-grass-300' : 'bg-zebra-200'}`}
                />
              ) : null}
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-pill type-label ${
                  state === 'done'
                    ? 'bg-grass-800 text-zebra-50'
                    : state === 'current'
                      ? 'bg-zebra-950 text-zebra-50'
                      : 'border border-zebra-300 bg-field text-zebra-500'
                }`}
              >
                {state === 'done' ? <Tick /> : n}
              </span>
              {s.railLabel}
            </li>
          );
        })}
      </ol>
      <div className="mt-auto space-y-3 px-2">
        <Progress step={step} />
        <p className="type-body text-zebra-500">{timeLeftLabel(step)} · editable later in Settings</p>
      </div>
    </nav>
  );
}

/**
 * Setup progress as one straight bar. Inside, one borderless segment
 * per step fills left to right as its step is reached; with no gaps the
 * segments read as a single line, and the fill needs no runtime width
 * (and no inline style) for any step count.
 * Shared with the phone header.
 */
export function Progress({ step }: { step: number }) {
  return (
    <div role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={TOTAL_STEPS} aria-valuenow={step} className="flex h-1 overflow-hidden rounded-pill bg-zebra-200">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <span key={i} className="h-full flex-1 overflow-hidden">
          <span
            className={`block h-full origin-left bg-grass-700 transition-[scale] duration-500 ease-out motion-reduce:transition-none ${i < step ? 'scale-x-100' : 'scale-x-0'}`}
          />
        </span>
      ))}
    </div>
  );
}

/**
 * A check that draws itself when a step is done: the path's dash is its
 * full length (24), animated from hidden to drawn.
 */
function Tick() {
  return (
    <svg aria-label="Done" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        strokeDasharray={24}
        className="motion-safe:animate-[tick-draw_400ms_cubic-bezier(0.65,0,0.35,1)_both]"
      />
    </svg>
  );
}

import { Pause, Play, RotateCcw } from 'lucide-react';
import type { KeyboardEvent, PointerEvent } from 'react';

import { Button } from '@/components/ui-v2/button';

import { STEPS } from './replay-data';
import type { ReplayClock } from './use-replay-clock';

/**
 * The replay's story column: what is happening, told big. When it
 * happened, a headline naming who did what, and one line on what it
 * means for the MC, rising in with each scene's card. At its foot one
 * continuous progress bar, which can be clicked or dragged to any
 * point, and a round play, pause or watch-again control.
 *
 * @module app/design-system/v2/pages/onboarding/replay/replay-story
 */

export function ReplayStory({ clock }: { clock: ReplayClock }) {
  const { step, ended } = clock;
  const overall = ended ? 1 : (step + clock.progress) / STEPS.length;
  const scene = STEPS[step];
  const control = ended
    ? { label: 'Watch again', icon: RotateCcw }
    : clock.playing
      ? { label: 'Pause', icon: Pause }
      : { label: 'Play', icon: Play };

  return (
    <div className="flex h-full flex-col">
      {/* Stays mounted so each new scene is read out; the text inside is
          re-keyed per scene so it rises in with its card. */}
      <div aria-live="polite" className="flex flex-1 flex-col justify-center">
        <div key={step}>
          <p className="whitespace-nowrap type-body text-zebra-500 tabular-nums motion-safe:animate-[reveal-up_500ms_cubic-bezier(0.22,1,0.36,1)_both]">
            {scene?.time}
          </p>
          <h3 className="mt-2 type-display text-zebra-950 motion-safe:animate-[reveal-up_600ms_100ms_cubic-bezier(0.22,1,0.36,1)_both]">
            {scene?.headline}
          </h3>
          <p className="mt-3 type-body text-zebra-600 motion-safe:animate-[reveal-up_600ms_250ms_cubic-bezier(0.22,1,0.36,1)_both]">
            {scene?.detail}
          </p>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-4">
        <Scrubber clock={clock} overall={overall} />
        <Button variant="secondary" square round aria-label={control.label} onClick={clock.toggle}>
          <control.icon aria-hidden="true" strokeWidth={1.5} className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * One continuous bar for the whole replay that can be clicked or
 * dragged to any point, and stepped scene by scene with the arrow keys.
 * The 4px bar sits in a 24px hit area so it is easy to grab. SVG, so the
 * fill width is an attribute that follows the clock, not a style.
 */
function Scrubber({ clock, overall }: { clock: ReplayClock; overall: number }) {
  const seekTo = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    clock.seek((e.clientX - r.left) / r.width);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const to = { ArrowLeft: clock.step - 1, ArrowRight: clock.step + 1, Home: 0, End: STEPS.length }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    clock.seek(to / STEPS.length);
  };
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Replay position"
      aria-valuemin={1}
      aria-valuemax={STEPS.length}
      aria-valuenow={clock.step + 1}
      aria-valuetext={`${STEPS[clock.step]?.label ?? ''}, ${clock.step + 1} of ${STEPS.length}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        seekTo(e);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) seekTo(e);
      }}
      onKeyDown={onKey}
      className="group/scrub flex h-6 flex-1 cursor-pointer touch-none items-center rounded-check focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500"
    >
      <svg aria-hidden="true" className="h-1 w-full overflow-visible">
        <rect width="100%" height="4" rx="2" className="fill-zebra-200" />
        <rect width={`${overall * 100}%`} height="4" rx="2" className="fill-[var(--b-primary)]" />
        {/* The playhead, shown on hover or focus so the bar reads as draggable. */}
        <circle
          cx={`${overall * 100}%`}
          cy="2"
          r="6"
          className="fill-[var(--b-primary)] opacity-0 transition-opacity duration-150 group-hover/scrub:opacity-100 group-focus-visible/scrub:opacity-100 motion-reduce:transition-none"
        />
      </svg>
    </div>
  );
}

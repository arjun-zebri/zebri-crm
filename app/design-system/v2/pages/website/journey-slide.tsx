'use client';

import { useEffect, useRef } from 'react';

import { Badge } from '@/components/ui-v2/badge';
import { IconCircle } from '@/components/ui-v2/icon-circle';
import { CheckIcon } from '@/components/ui-v2/icons';

import { DocsAccount, STAGE, STEP_SCENES } from './journey-docs';
import { EASE, type ShotStep } from './journey-step';

/**
 * One step of the Journeys band as a phone sees it: a single card, the
 * step as its head (what it sends, what sets it off, and its badge once
 * it has happened), what it sent under that, and the line on what
 * happened as its foot. Phones swipe these in a `SwipeRow`; a step card
 * over a separate record card read as two things (founder, 2026-10-19).
 * The couple's head is left out: the step is the head here.
 *
 * The scene is laid out on the stage's 680 by 480 canvas and zoomed to
 * the card's width, as `JourneyStage` does.
 *
 * @module app/design-system/v2/pages/website/journey-slide
 */

interface JourneySlideProps {
  step: ShotStep;
  /** Its index, for its scene. */
  index: number;
  /** It has happened. */
  done: boolean;
}

/** One step's card. See {@link JourneySlideProps}. */
export function JourneySlide({ step, index, done }: JourneySlideProps) {
  const canvas = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // Measured, as the stage's is: a length over a length is the one value CSS cannot work out.
    const observer = new ResizeObserver(([entry]) => {
      if (entry) el.style.setProperty('--stage-zoom', String(Math.min(1, entry.contentRect.width / STAGE.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const Scene = STEP_SCENES[index];
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-panel bg-field shadow-lg ring-1 ring-zebra-950/10">
      <div className="flex items-start gap-3 border-b border-hairline p-4">
        <IconCircle tone={done ? 'grass' : 'neutral'} icon={done ? CheckIcon : step.icon} className={EASE} />
        <div className="min-w-0 flex-1">
          <p className="type-label text-zebra-950">{step.name}</p>
          <p className="type-body text-zebra-500">{step.when}</p>
        </div>
        <Badge tone="grass" className={`shrink-0 ${EASE} ${done ? 'opacity-100' : 'opacity-0'}`}>
          {step.done}
        </Badge>
      </div>
      {/* flex-1: the slides share the tallest one's height, and the spare goes to the canvas. */}
      <div ref={canvas} aria-hidden="true" inert className="flex-1 overflow-hidden bg-zebra-50">
        <div className="relative mx-auto h-[30rem] w-[42.5rem] [zoom:var(--stage-zoom,1)]">
          {Scene ? (
            <DocsAccount>
              <Scene />
            </DocsAccount>
          ) : null}
        </div>
      </div>
      {/* Wraps, the date under it: on one line a phone cut the event to "Sent for you, 2 m…". */}
      <p className="flex shrink-0 items-start gap-2.5 border-t border-hairline px-4 py-3 type-body">
        <span className="mt-1.5 size-2 shrink-0 rounded-pill bg-grass-500 ring-4 ring-grass-100" />
        <span className="min-w-0 flex-1">
          <span className="block text-pretty text-zebra-600">{step.event}</span>
          <span className="block text-zebra-400">{step.at}</span>
        </span>
      </p>
    </div>
  );
}

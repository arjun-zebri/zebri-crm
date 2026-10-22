'use client';

import { useEffect, useRef } from 'react';

import { Avatar } from '@/components/ui-v2/avatar';
import { Badge } from '@/components/ui-v2/badge';
import { ensureBrandFontsStylesheet } from '@/lib/branding/fonts';

import { DocsAccount, STAGE, STEP_SCENES } from './journey-docs';
import { EASE, STACK } from './journey-step';
import { RecordFrame, sceneClass, type RecordEvent } from './record-frame';

/**
 * The Journeys band's stage: one container, shaped like the couple's
 * record in Zebri (`RecordFrame`, shared with the BDM row). Its head is Mia and Leo, Enquiry turning to Booked;
 * its body a quiet canvas with what the step on the stage sent, the
 * document itself at real size (`journey-docs.tsx`); its foot one line
 * on what just happened ("Signed by Jess, Mia and Leo"), so the visitor
 * reads the outcome as well as sees it. The hand-off runs in turn: the
 * last scene clears in 200ms, then the new one rises in, so two pages
 * never show through each other mid-change (they did when both moved
 * at once).
 *
 * Laid out once at 680 by 600 and zoomed to the width it is given (never
 * up), so a phone sees the same picture, smaller, rather than a reflow.
 * The zoom is measured, as the hero's is: a length over a length is the
 * one value CSS cannot work out. A picture: inert and hidden from screen
 * readers, as the steps beside it say what each one did.
 *
 * @module app/design-system/v2/pages/website/journey-stage
 */

interface JourneyStageProps {
  /** The step on the stage; none before the first tick. */
  shown: number;
  /** The couple has paid their deposit. */
  booked: boolean;
  /** Each step's footer line and date, by step index. */
  events: RecordEvent[];
}

/** The stage. See {@link JourneyStageProps}. */
export function JourneyStage({ shown, booked, events }: JourneyStageProps) {
  const ref = useRef<HTMLDivElement>(null);
  // The scenes set the brand's fonts, which only the editors load otherwise.
  useEffect(() => ensureBrandFontsStylesheet(), []);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) el.style.setProperty('--stage-zoom', String(Math.min(1, entry.contentRect.width / STAGE.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} aria-hidden="true" inert className="w-full">
      <RecordFrame
        className="mx-auto h-[37.5rem] w-[42.5rem] [zoom:var(--stage-zoom,1)]"
        events={events}
        shown={shown}
        head={
          <div className="flex h-10 items-center gap-3">
            <Avatar name="Mia Leo" tone="soft" />
            <div className="min-w-0 flex-1">
              <p className="type-label text-zebra-950">Mia &amp; Leo</p>
              <p className="type-body text-zebra-500">Wedding, Sat 13 Mar 2027 · Bendooley Estate</p>
            </div>
            <span className="grid justify-items-end">
              <Badge className={`${STACK} ${EASE} ${booked ? 'opacity-0' : 'opacity-100'}`}>Enquiry</Badge>
              <Badge tone="grass" className={`${STACK} ${EASE} ${booked ? 'opacity-100' : 'opacity-0'}`}>
                Booked
              </Badge>
            </span>
          </div>
        }
      >
        <DocsAccount>
          {STEP_SCENES.map((Scene, i) => (
            <div key={i} className={sceneClass(i, shown)}>
              <Scene />
            </div>
          ))}
        </DocsAccount>
      </RecordFrame>
    </div>
  );
}

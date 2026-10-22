'use client';

import { JourneyPath } from '../../journeys/journey-path';
import { JOURNEYS, type Journey } from '../../journeys/journeys-data';

import { BlockImageFrame, SCENE_CARD, SCENE_WIDE } from './block-image-frame';

/**
 * Journeys product image (block id `workflows`): the Full weddings
 * journey on the real Journeys line (`JourneyPath`), its first steps in
 * order, each with when it goes out beside the line, its follow-ups and
 * the dot for who it waits on, the journey tabs above it. Laid out on the
 * 640 by 360 layer at 75%, as Calendar is, the line bleeding off the foot
 * as the real page carries on.
 *
 * Moment: "a wedding's follow-ups, set once, in the order they go out".
 *
 * @module app/design-system/v2/pages/dashboard/blocks/images/journeys
 */

const none = () => undefined;

const FULL = JOURNEYS.find((j) => j.id === 'full') ?? JOURNEYS[0]!;
/** The first steps only: the crop shows four, and a fifth runs off the foot. */
const SHOWN: Journey = { ...FULL, steps: FULL.steps.slice(0, 5) };

/** The journey tabs, as the page's bar shows them, Full weddings picked. */
const TABS = ['Full weddings', 'Ceremony only', 'Corporate'];

/** Journeys block image. */
export function JourneysImage() {
  return (
    <BlockImageFrame alt="The Full weddings journey: the enquiry reply, proposal, contract and deposit on one line, each with when it goes out and its follow-ups.">
      <div className={SCENE_WIDE}>
        <div className={`${SCENE_CARD} -bottom-6 left-6 right-6 top-6 px-6 pt-5`}>
          <p className="flex items-center gap-5 pb-5 type-body">
            {TABS.map((t, i) => (
              <span key={t} className={i === 0 ? 'type-label text-zebra-950' : 'text-zebra-500'}>
                {t}
              </span>
            ))}
          </p>
          {/* The timing column is 9rem on the page; the card is narrower, so the line keeps it and the cards take the rest. */}
          <div className="-ml-12">
            <JourneyPath journey={SHOWN} onOpen={none} onReorder={none} onAdd={none} />
          </div>
        </div>
      </div>
    </BlockImageFrame>
  );
}

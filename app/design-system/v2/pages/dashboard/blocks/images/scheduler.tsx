'use client';

import { brandVars } from '../../../onboarding/brand-doc-parts';
import { INITIAL } from '../../../onboarding/use-onboarding-state';
import { useAccount } from '../../account';
import { BookingHeader, BookingPicker } from '../../booking/settings/booking-page';
import { useBookingLinks } from '../../booking/use-booking-links';

import { BlockImageFrame, SCENE_CARD, SCENE_WIDE } from './block-image-frame';

/**
 * Booking links product image draft (`/new-block-image scheduler`):
 * the booking page a couple sees for the MC's first booking type, in
 * the MC's brand, with only the times they are free. Built from the real
 * `BookingHeader` and `BookingPicker`, so it shows the live booking
 * types and hours.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/images/scheduler
 */

// A Wednesday evening, so the first open day is Thursday 4 March and the
// whole of its day is bookable: a still image must not move with the clock.
const NOW = new Date(2027, 2, 3, 18, 0);

/**
 * F: the month and Thursday's times, with the booking type on a card in
 * front over the page's empty left margin.
 */
export function SchedulerImageF() {
  const { brand } = useAccount();
  const link = useBookingLinks().links[0];
  if (!link) return null;
  return (
    <BlockImageFrame alt="A couple's booking page: an intro call by video on a card in front, March's free days in the MC's colour and Thursday's times.">
      {/* Laid out on a 640 by 360 scene shown at 75%: the booking page at real size read too zoomed in (user).
          Brand values are the MC's, chosen at runtime, so they arrive as custom properties. */}
      <div style={brandVars(brand ?? INITIAL.brand)} className={SCENE_WIDE}>
        {/* Wider than the Settings preview's page, so the day circles have room between them. */}
        <div className={`${SCENE_CARD} -bottom-6 right-6 top-12 w-[30rem]`}>
          <BookingPicker link={link} now={NOW} />
        </div>
        <div className={`${SCENE_CARD} left-5 top-24 w-36 shadow-md [&>header]:border-b-0 [&>header]:p-4`}>
          <BookingHeader link={{ ...link, description: '' }} />
        </div>
      </div>
    </BlockImageFrame>
  );
}

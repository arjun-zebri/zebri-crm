'use client';

import { GroupLabel } from '@/components/ui-v2/group-label';

import { brandVars } from '../../../onboarding/brand-doc-parts';
import { INITIAL } from '../../../onboarding/use-onboarding-state';
import { useAccount } from '../../account';
import type { BookingLink } from '../booking-data';

import { BookingHeader, BookingPicker } from './booking-page';

/**
 * The booking page a couple sees, live beside a booking type's sheet:
 * the real page (`booking-page.tsx`) in the MC's brand, under a quiet
 * label, on the grey preview well with no border or second frame, as
 * the questionnaire builder's preview sits. Every chip in the sheet changes what shows (a longer booking
 * or wider breaks leave fewer times, more notice moves the first day
 * on).
 *
 * @module app/design-system/v2/pages/dashboard/booking/settings/booking-preview
 */

/** The preview. See the module comment. */
export function BookingPreview({ link }: { link: BookingLink }) {
  const { brand } = useAccount();
  return (
    // The preview well: grey, no border, inset to the body's padding (as the questionnaire builder's).
    <aside
      aria-label="What couples see"
      className="mx-6 mb-6 flex shrink-0 flex-col rounded-panel bg-zebra-50 sm:mx-10 sm:mb-10 lg:ml-0 lg:mt-10 lg:min-h-0 lg:w-[36rem]"
    >
      <div className="flex min-h-9 items-center px-7 pt-4">
        <GroupLabel>What couples see</GroupLabel>
      </div>
      {/* Brand values are the MC's, chosen at runtime, so they arrive as custom properties. */}
      <div style={brandVars(brand ?? INITIAL.brand)} className="min-h-0 flex-1 overflow-y-auto max-lg:max-h-96">
        <BookingHeader link={link} />
        <BookingPicker link={link} />
      </div>
    </aside>
  );
}

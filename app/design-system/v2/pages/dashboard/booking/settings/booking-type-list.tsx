'use client';

import { Button } from '@/components/ui-v2/button';
import { PlusIcon } from '@/components/ui-v2/icons';

import { SettingsSection } from '../../enquiries/settings/pane-parts';
import { BOOKING_HOST, type BookingLink } from '../booking-data';
import { openSheet } from '../use-booking-links';

import { BookingTypeRow } from './booking-type-row';

/**
 * Settings' list of booking types (`BookingTypeRow`), unboxed on the
 * pane. A last "New booking type" (the house add action: a compact
 * ghost button with a plus) opens a blank sheet, so adding one reads as
 * part of the list rather than a control under it.
 *
 * @module app/design-system/v2/pages/dashboard/booking/settings/booking-type-list
 */
export function BookingTypeList({ links }: { links: readonly BookingLink[] }) {
  return (
    <SettingsSection
      title="Booking types"
      why={`Links couples book a time from, at ${BOOKING_HOST}.`}
    >
      {/* Unboxed, no rules between rows: a bordered table was too hard for v2. Rows bleed 8px so
          their hover fill has room while the names keep the section's edge. */}
      <ul className="-mx-2 space-y-0.5">
        {links.map((l) => (
          <BookingTypeRow key={l.slug} link={l} />
        ))}
        <li>
          <Button variant="ghost" compact icon={<PlusIcon aria-hidden="true" className="size-4" />} onClick={() => openSheet('new')}>
            New booking type
          </Button>
        </li>
      </ul>
    </SettingsSection>
  );
}

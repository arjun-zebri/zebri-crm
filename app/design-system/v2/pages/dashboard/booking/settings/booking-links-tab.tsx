'use client';

import { Collapse } from '@/components/ui-v2/collapse';

import { CalendarRows } from '../../calendar/settings/calendar-rows';
import { useCalendarSync } from '../../calendar/use-calendar-sync';
import { SettingsSection } from '../../enquiries/settings/pane-parts';
import { useBookingLinks } from '../use-booking-links';

import { AvailabilitySection } from './availability-section';
import { BookingTypeList } from './booking-type-list';
import { BookingTypeSheet } from './booking-type-sheet';

/**
 * The Booking links tab of Settings, where adding the Booking links
 * block lands. Until a calendar is connected it opens on the connect
 * rows, since no one can be shown free times without one; they are the
 * same connection as the Calendar tab's, and fold away once one is in.
 * Then the booking types, the main thing, and the hours and days off
 * they share. A type (or New booking type, here or in the calendar
 * popover) opens in a sheet over Settings. Owned by the Booking links
 * feature; the Settings shell only lists it.
 *
 * @module app/design-system/v2/pages/dashboard/booking/settings/booking-links-tab
 */
export function BookingLinksTab() {
  const s = useBookingLinks();
  const sync = useCalendarSync();
  const open = s.sheet === 'new' ? undefined : s.links.find((l) => l.slug === s.sheet);
  return (
    <div>
      {/* The gap below lives inside the fold, so nothing is left over once it shuts. */}
      <Collapse open={sync.connected.size === 0}>
        <div className="pb-8">
          <SettingsSection title="Connect your calendar" why="So couples only see the times you're free.">
            <CalendarRows />
          </SettingsSection>
        </div>
      </Collapse>
      <div className="space-y-8">
        <BookingTypeList links={s.links} />
        <AvailabilitySection hours={s.hours} perDay={s.perDay} daysOff={s.daysOff} />
      </div>
      {/* Keyed by what it opens on, so each opening starts from that type (or blank). */}
      {s.sheet !== null && (s.sheet === 'new' || open) ? <BookingTypeSheet key={s.sheet} link={open} /> : null}
    </div>
  );
}

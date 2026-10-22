'use client';

import { SettingsSection } from '../../enquiries/settings/pane-parts';

import { CalendarRows } from './calendar-rows';

/**
 * The Calendar tab of Settings, where adding the Calendar block lands:
 * the Google Calendar and Outlook connect rows under a line that says
 * what they are for: a two-way sync that keeps clients from booking a
 * time the MC has taken. A connected calendar's busy times show on the
 * calendar popover. Simulated.
 *
 * @module app/design-system/v2/pages/dashboard/calendar/settings/calendar-tab
 */
export function CalendarTab() {
  return (
    <SettingsSection title="Your calendars" why="Syncs both ways. Your events, calls and bookings go into your calendar, and anything already in it marks you as busy, so clients can never book a time or date you've already taken.">
      <CalendarRows />
    </SettingsSection>
  );
}

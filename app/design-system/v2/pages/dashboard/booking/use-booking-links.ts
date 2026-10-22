import { useSyncExternalStore } from 'react';

import {
  SEED_DAYS_OFF,
  SEED_HOURS,
  SEED_LINKS,
  WEEKDAYS,
  type BookingLink,
  type DayHours,
  type DayOff,
  type Weekday,
} from './booking-data';

/**
 * The Booking links block's state for the preview: the booking types,
 * the weekly hours and days off, and which type's sheet is open.
 * One store for the whole preview (like `calendar/use-calendar-sync.ts`),
 * so a switch flipped in the calendar popover shows in Settings, and the
 * popover's New booking type can open Settings with the sheet already
 * up. Nothing persists past a reload.
 *
 * @module app/design-system/v2/pages/dashboard/booking/use-booking-links
 */

interface Stored {
  links: readonly BookingLink[];
  hours: Readonly<Record<Weekday, DayHours>>;
  /** Off, every working day shares one set of hours; on, each day has its own. */
  perDay: boolean;
  daysOff: readonly DayOff[];
  /** The type whose sheet is open: its slug, `'new'` for a new one, or null. */
  sheet: string | null;
}

let state: Stored = { links: SEED_LINKS, hours: SEED_HOURS, perDay: false, daysOff: SEED_DAYS_OFF, sheet: null };
let made = 0;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const read = () => state;
const write = (next: Partial<Stored>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};

/** Changes one booking type in place (its live switch). */
export const updateLink = (slug: string, patch: Partial<BookingLink>) =>
  write({ links: state.links.map((l) => (l.slug === slug ? { ...l, ...patch } : l)) });

/** Opens a type's sheet, `'new'` for a blank one, or closes it (null). */
export const openSheet = (slug: string | null) => write({ sheet: slug });

/** Keeps the sheet's draft: replaces the type it was opened on, or adds a new one. Closes the sheet. */
export const saveLink = (draft: BookingLink) => {
  if (state.links.some((l) => l.slug === draft.slug)) {
    write({ links: state.links.map((l) => (l.slug === draft.slug ? draft : l)), sheet: null });
    return;
  }
  write({ links: [...state.links, draft], sheet: null });
};

/** A slug no type has yet, for a new one. */
export const freshSlug = () => `new-${(made += 1)}`;

/** Deletes a booking type and closes its sheet. */
export const deleteLink = (slug: string) => write({ links: state.links.filter((l) => l.slug !== slug), sheet: null });

/** Changes one weekday's hours. */
export const setHours = (day: Weekday, patch: Partial<DayHours>) =>
  write({ hours: { ...state.hours, [day]: { ...state.hours[day], ...patch } } });

/** The shared hours, set on every day at once. */
export const setAllHours = (from: string, to: string) =>
  write({ hours: Object.fromEntries(WEEKDAYS.map((d) => [d, { ...state.hours[d], from, to }])) as Record<Weekday, DayHours> });

/**
 * Turns per-day hours on or off. Back to one set, every day takes the
 * first working day's hours, so the shared chip says something true.
 */
export const setPerDay = (perDay: boolean) => {
  if (!perDay) {
    const first = WEEKDAYS.map((d) => state.hours[d]).find((h) => h.on) ?? state.hours.Monday;
    setAllHours(first.from, first.to);
  }
  write({ perDay });
};

/** Adds a day or run of days off, kept in date order. */
export const addDayOff = (off: DayOff) =>
  write({ daysOff: [...state.daysOff.filter((d) => d.from !== off.from), off].sort((a, b) => a.from.localeCompare(b.from)) });

export const removeDayOff = (from: string) => write({ daysOff: state.daysOff.filter((d) => d.from !== from) });

/** The Booking links state, kept current. */
export function useBookingLinks() {
  return useSyncExternalStore(subscribe, read, read);
}

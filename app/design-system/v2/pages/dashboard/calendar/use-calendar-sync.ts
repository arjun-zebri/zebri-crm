import { useState, useSyncExternalStore } from 'react';

import type { CalendarSource } from './calendar-data';

/**
 * Which of the MC's own calendars are connected. Settings' Calendar tab
 * connects them and the calendar popover draws their busy times, so it
 * is one store for the whole preview (like
 * `enquiries/settings/use-enquiry-settings.ts`). Connect is simulated:
 * a short busy beat, then connected. Nothing leaves the page or
 * survives a reload.
 *
 * @module app/design-system/v2/pages/dashboard/calendar/use-calendar-sync
 */

// Long enough to read as a sign-in happening, short enough not to wait on.
const CONNECT_MS = 900;

interface Stored {
  connected: ReadonlySet<CalendarSource>;
}

let state: Stored = { connected: new Set() };
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

/** The connected calendars and what changes them. */
export function useCalendarSync() {
  const s = useSyncExternalStore(subscribe, read, read);
  // Which calendar is mid sign-in; only the tab that started it needs to know.
  const [connecting, setConnecting] = useState<CalendarSource | null>(null);

  const connect = (id: CalendarSource) => {
    setConnecting(id);
    window.setTimeout(() => {
      write({ connected: new Set([...state.connected, id]) });
      setConnecting(null);
    }, CONNECT_MS);
  };
  const disconnect = (id: CalendarSource) => write({ connected: new Set([...state.connected].filter((x) => x !== id)) });

  return { ...s, connecting, connect, disconnect };
}

/** What {@link useCalendarSync} returns. */
export type CalendarSync = ReturnType<typeof useCalendarSync>;

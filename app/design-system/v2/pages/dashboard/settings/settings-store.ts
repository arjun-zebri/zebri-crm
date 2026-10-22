import { useSyncExternalStore } from 'react';

/**
 * Whether Settings is open, and on which tab. One store for the whole
 * preview, so the sidebar's gear and the Enquiries popover's Settings
 * button open the same dialog, which each dashboard page renders once.
 *
 * @module app/design-system/v2/pages/dashboard/settings/settings-store
 */

/** A Settings tab; more come later. */
export type SettingsTab =
  | 'business'
  | 'email'
  | 'enquiries'
  | 'calendar'
  | 'booking-links'
  | 'lodge-with-bdm';

let open: SettingsTab | null = null;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const read = () => open;
const set = (next: SettingsTab | null) => {
  open = next;
  listeners.forEach((l) => l());
};

/** Opens Settings on a tab (Business, the first, when left out). */
export const openSettings = (tab: SettingsTab = 'business') => set(tab);
/** Closes Settings. */
export const closeSettings = () => set(null);

/** The open tab, or null while Settings is shut. */
export function useSettingsOpen() {
  return useSyncExternalStore(subscribe, read, () => null);
}

import { useSyncExternalStore } from 'react';

/**
 * Whether the brand kit is open. One store for the whole preview, so the
 * sidebar's name card (and anything else later) opens the one dialog each
 * dashboard page renders, the same way Settings works.
 *
 * @module app/design-system/v2/pages/dashboard/brand/your-look-store
 */

let open = false;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const set = (next: boolean) => {
  open = next;
  listeners.forEach((l) => l());
};

/** Opens the brand kit. */
export const openYourLook = () => set(true);
/** Closes the brand kit. */
export const closeYourLook = () => set(false);

/** Whether the brand kit is open. */
export function useYourLookOpen() {
  return useSyncExternalStore(subscribe, () => open, () => false);
}

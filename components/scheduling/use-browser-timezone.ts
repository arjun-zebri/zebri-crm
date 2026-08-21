/**
 * The IANA timezone the current browser reports.
 *
 * Read through `useSyncExternalStore` rather than an effect: the server
 * snapshot is deliberately empty so SSR and the first client render agree,
 * and the client snapshot must be referentially stable or React re-renders
 * forever. Caching at module scope gives both, and avoids the
 * `react-hooks/set-state-in-effect` trap.
 *
 * @module components/scheduling/use-browser-timezone
 */
'use client';

import { useSyncExternalStore } from 'react';

import { detectViewerTimezone } from '@/lib/scheduling/timezone-options';

/** The zone never changes for the life of the page, so there is nothing to subscribe to. */
const subscribeToNothing = () => () => {};

let cachedZone: string | null | undefined;

/** Client snapshot: the detected zone, or `''` where the runtime cannot say. */
function getClientZone(): string {
  if (cachedZone === undefined) cachedZone = detectViewerTimezone();
  return cachedZone ?? '';
}

/** Server snapshot: always empty, so callers fall back deliberately. */
const getServerZone = () => '';

/**
 * The browser's IANA zone, or `''` on the server and where detection fails.
 *
 * Returns `''` rather than a guess so each caller picks its own fallback; on
 * Vercel the server zone is UTC, which is nobody's actual timezone.
 */
export function useBrowserTimezone(): string {
  return useSyncExternalStore(subscribeToNothing, getClientZone, getServerZone);
}

/** Reset the module cache. Test-only. */
export function __resetBrowserTimezoneCache(): void {
  cachedZone = undefined;
}

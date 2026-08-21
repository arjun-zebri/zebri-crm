/**
 * The timezone the MC reads their own calendar in.
 *
 * One answer for the whole dashboard. Every grid surface used to inline
 * `availability?.timezone || 'UTC'`, which meant a brand-new MC — whose
 * `user_public_settings.timezone` is null until they first save on the
 * Availability tab — had their connected calendar drawn on a UTC clock. In
 * Sydney that put every event ten hours from where it belongs, while the
 * Availability tab simultaneously showed them their browser zone, so the
 * setting looked correct.
 *
 * @module app/(dashboard)/calendar/use-mc-timezone
 */
'use client';

import { useBrowserTimezone } from '@/components/scheduling/use-browser-timezone';

import { useAvailability } from './use-availability';

/**
 * Resolve the MC's display timezone.
 *
 * Precedence: the zone they saved → the zone their browser reports → `UTC`.
 * UTC is the last resort only, never the answer for someone who simply has
 * not visited the Availability tab yet.
 */
export function useMcTimezone(): string {
  const { data } = useAvailability();
  const browserTimezone = useBrowserTimezone();
  return data?.timezone || browserTimezone || 'UTC';
}

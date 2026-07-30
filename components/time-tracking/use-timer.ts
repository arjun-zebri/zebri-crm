/**
 * React Query access to the user's single running timer, plus the
 * one-second tick that drives every elapsed display.
 *
 * Elapsed time is measured against the *server's* clock: the read
 * returns `server_now`, from which a client offset is derived, so a
 * device with a skewed clock cannot show a wrong or negative duration.
 *
 * The tick lives in its own hook rather than in the provider on purpose.
 * A ticking provider would re-render the entire dashboard once a second;
 * this way only the two small surfaces that show a stopwatch re-render.
 *
 * @module components/time-tracking/use-timer
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { getRunningTimerAction } from '@/app/(dashboard)/couples/time-actions';
import type { RunningTimer } from '@/types/time-tracking';

/** Query key for the running timer. */
export const RUNNING_TIMER_KEY = ['running-timer'] as const;

/** The running session plus the client/server clock offset. */
export interface RunningTimerRead {
  running: RunningTimer | null;
  clockOffsetMs: number;
}

/**
 * Read the running timer. Disabled entirely when `enabled` is false, so a
 * shadow session issues no timer reads at all.
 */
export function useRunningTimer(enabled: boolean) {
  const { data, isLoading } = useQuery({
    queryKey: RUNNING_TIMER_KEY,
    enabled,
    // The row is the source of truth and another device can change it,
    // so this must never be served from a stale cache.
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<RunningTimerRead> => {
      const result = await getRunningTimerAction();
      if (!result.ok) throw new Error(result.error);
      if (!result.data) return { running: null, clockOffsetMs: 0 };
      return {
        running: result.data,
        clockOffsetMs: Date.parse(result.data.server_now) - Date.now(),
      };
    },
  });

  return {
    running: data?.running ?? null,
    clockOffsetMs: data?.clockOffsetMs ?? 0,
    isLoading,
  };
}

/**
 * Server-corrected "now", refreshed every second while `active`. Returns
 * a millisecond instant, so callers derive elapsed with the same pure
 * helpers used everywhere else.
 */
export function useTimerTick(active: boolean, clockOffsetMs: number): number {
  const [nowMs, setNowMs] = useState(() => Date.now() + clockOffsetMs);

  useEffect(() => {
    if (!active) return;
    const update = () => setNowMs(Date.now() + clockOffsetMs);
    // The immediate refresh goes through a timer rather than running in
    // the effect body: the offset only becomes known once the running
    // timer read resolves, and a synchronous setState here would cascade
    // a second render on every mount.
    const immediate = setTimeout(update, 0);
    const id = setInterval(update, 1000);
    return () => {
      clearTimeout(immediate);
      clearInterval(id);
    };
  }, [active, clockOffsetMs]);

  return nowMs;
}

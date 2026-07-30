/**
 * App-level owner of the couple timer.
 *
 * Mounted once in the dashboard layout so that:
 * - any surface can start or stop a timer without prop drilling;
 * - the running pill is visible on every page, not just `/couples`;
 * - the stop-note dialog always has somewhere to appear, even if the
 *   user has since navigated away from the couple being timed.
 *
 * Surfaces that cover the viewport's top-right corner (the couple
 * profile overlay, whose close button lives there) call `claimSurface()`
 * to hide the pill for as long as they are open and take over the timer
 * control themselves. The claim is a counter, not a boolean, so two
 * nested surfaces cannot release each other's claim.
 *
 * @module components/time-tracking/timer-provider
 */
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  startCoupleTimerAction,
  stopCoupleTimerAction,
} from '@/app/(dashboard)/couples/time-actions';
import { useToast } from '@/components/ui/toast';
import type { RunningTimer, StoppedSession } from '@/types/time-tracking';

import { StopNoteDialog } from './stop-note-dialog';
import { TimerPill } from './timer-pill';
import { COUPLE_TIME_ENTRIES_KEY } from './use-time-categories';
import { RUNNING_TIMER_KEY, useRunningTimer } from './use-timer';

export interface TimerSurface {
  /** True while an admin is impersonating: every control is hidden. */
  shadowing: boolean;
  running: RunningTimer | null;
  /** Milliseconds to add to the device clock to match the server's. */
  clockOffsetMs: number;
  /** Whether the running timer belongs to this couple. */
  isRunningFor: (coupleId: string) => boolean;
  /** Start timing a couple, stopping whatever was running first. */
  start: (coupleId: string) => void;
  /** Stop the running timer and offer its note dialog. */
  stop: () => void;
  /** Hide the pill while a top-right surface is open. Returns its release. */
  claimSurface: () => () => void;
}

const TimerSurfaceContext = createContext<TimerSurface | null>(null);

/** Access the app-level timer. Throws outside {@link TimerProvider}. */
export function useTimerSurface(): TimerSurface {
  const value = useContext(TimerSurfaceContext);
  if (!value) {
    throw new Error('useTimerSurface must be used inside a TimerProvider');
  }
  return value;
}

export interface TimerProviderProps {
  shadowing: boolean;
  children: ReactNode;
}

export function TimerProvider({ shadowing, children }: TimerProviderProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { running, clockOffsetMs } = useRunningTimer(!shadowing);
  const [pending, setPending] = useState<StoppedSession | null>(null);
  const [claims, setClaims] = useState(0);

  const invalidate = useCallback(
    (coupleId?: string) => {
      void queryClient.invalidateQueries({ queryKey: RUNNING_TIMER_KEY });
      void queryClient.invalidateQueries({
        queryKey: coupleId
          ? [COUPLE_TIME_ENTRIES_KEY, coupleId]
          : [COUPLE_TIME_ENTRIES_KEY],
      });
    },
    [queryClient],
  );

  const startMutation = useMutation({
    mutationFn: async (coupleId: string) => {
      const result = await startCoupleTimerAction(coupleId);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      invalidate(data.started.couple_id);
      // Switching couples stops the previous session. Offer its note
      // dialog rather than silently swallowing the annotation.
      if (data.stopped) {
        invalidate(data.stopped.entry.couple_id);
        setPending(data.stopped);
        toast(`Stopped timing ${data.stopped.couple_name}`);
      }
    },
    onError: () => toast('Could not start the timer', 'error'),
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      const result = await stopCoupleTimerAction();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (stopped) => {
      invalidate(stopped?.entry.couple_id);
      if (stopped) setPending(stopped);
    },
    onError: () => toast('Could not stop the timer', 'error'),
  });

  const claimSurface = useCallback(() => {
    setClaims((n) => n + 1);
    return () => setClaims((n) => Math.max(0, n - 1));
  }, []);

  const value = useMemo<TimerSurface>(
    () => ({
      shadowing,
      running,
      clockOffsetMs,
      isRunningFor: (coupleId: string) =>
        running?.entry.couple_id === coupleId,
      start: (coupleId: string) => {
        if (shadowing) return;
        startMutation.mutate(coupleId);
      },
      stop: () => {
        if (shadowing) return;
        stopMutation.mutate();
      },
      claimSurface,
    }),
    [shadowing, running, clockOffsetMs, startMutation, stopMutation, claimSurface],
  );

  return (
    <TimerSurfaceContext.Provider value={value}>
      {children}
      <TimerPill hidden={claims > 0} />
      <StopNoteDialog pending={pending} onClose={() => setPending(null)} />
    </TimerSurfaceContext.Provider>
  );
}

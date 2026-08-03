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
 * Both writes are **optimistic**: the running-timer cache flips on the
 * click and the server action reconciles it afterwards. A stopwatch that
 * does not visibly start (or stop) until a round trip completes reads as
 * a broken button, and an MC clicking twice would start, stop, restart.
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
  useSyncExternalStore,
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
import {
  RUNNING_TIMER_KEY,
  useRunningTimer,
  type RunningTimerRead,
} from './use-timer';

export interface TimerSurface {
  /** True while an admin is impersonating: every control is hidden. */
  shadowing: boolean;
  running: RunningTimer | null;
  /** Milliseconds to add to the device clock to match the server's. */
  clockOffsetMs: number;
  /** Whether the running timer belongs to this couple. */
  isRunningFor: (coupleId: string) => boolean;
  /**
   * Start timing a couple, stopping whatever was running first. Pass the
   * couple's name where it is known so the optimistic pill can label
   * itself before the server read lands.
   */
  start: (coupleId: string, coupleName?: string) => void;
  /** Stop the running timer and offer its note dialog. */
  stop: () => void;
  /** Hide the pill while a top-right surface is open. Returns its release. */
  claimSurface: () => () => void;
}

/** Nothing running, used as the rollback floor when no snapshot exists. */
const IDLE: RunningTimerRead = { running: null, clockOffsetMs: 0 };

/** Marks the placeholder session that only exists until the insert lands. */
const OPTIMISTIC_ENTRY_ID = 'optimistic-running-entry';

/** Variables for the start mutation. */
interface StartVariables {
  coupleId: string;
  coupleName: string | undefined;
}

/**
 * The cache value to show the instant "start" is clicked.
 *
 * `started_at` is stamped in *server* time (device clock plus the known
 * offset) because that is the clock every elapsed display measures
 * against. The real row starts one network hop later, so reconciliation
 * can shave a few hundred milliseconds off the count: invisible at the
 * one-second granularity the stopwatch renders.
 */
function optimisticStart(
  previous: RunningTimerRead | undefined,
  { coupleId, coupleName }: StartVariables,
): RunningTimerRead {
  const clockOffsetMs = previous?.clockOffsetMs ?? 0;
  const nowIso = new Date(Date.now() + clockOffsetMs).toISOString();
  return {
    clockOffsetMs,
    running: {
      entry: {
        id: OPTIMISTIC_ENTRY_ID,
        couple_id: coupleId,
        started_at: nowIso,
        ended_at: null,
        category_id: null,
        category_name: null,
        category_color: null,
        note: null,
        auto_stopped: false,
      },
      couple_name: coupleName ?? '',
      server_now: nowIso,
    },
  };
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

/**
 * Whether an admin is impersonating an MC right now.
 *
 * `zebri_is_shadowing` is set with `httpOnly: false` so the browser can
 * read it, which keeps the dashboard layout a synchronous server
 * component: awaiting `cookies()` there made the segment dynamic and the
 * sidebar intermittently lost the root QueryClientProvider.
 */
function readShadowCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split('; ')
    .some((entry) => entry === 'zebri_is_shadowing=1');
}

/** The cookie only changes across a full navigation, so nothing to watch. */
const subscribeToNothing = () => () => {};

export interface TimerProviderProps {
  /**
   * Force the shadow state. Omit in the app (the cookie is read on
   * mount); tests pass it explicitly.
   */
  shadowing?: boolean;
  children: ReactNode;
}

export function TimerProvider({
  shadowing: shadowingProp,
  children,
}: TimerProviderProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // Read through `useSyncExternalStore` so the server snapshot is `false`
  // and the client snapshot is the real cookie: no hydration mismatch and
  // no setState in an effect. A shadow session therefore issues at most
  // one timer read before the controls disappear, and can never write.
  const cookieShadowing = useSyncExternalStore(
    subscribeToNothing,
    readShadowCookie,
    () => false,
  );
  const shadowing = shadowingProp ?? cookieShadowing;
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

  /**
   * Put the running-timer cache back and re-read the truth. Used by both
   * rollbacks: the snapshot may be `undefined` (nothing cached yet), and
   * `setQueryData(key, undefined)` is a no-op, so the idle value is the
   * floor rather than a way of leaving the optimistic row behind.
   */
  const rollback = useCallback(
    (previous: RunningTimerRead | undefined) => {
      queryClient.setQueryData<RunningTimerRead>(
        RUNNING_TIMER_KEY,
        previous ?? IDLE,
      );
      void queryClient.invalidateQueries({ queryKey: RUNNING_TIMER_KEY });
    },
    [queryClient],
  );

  const startMutation = useMutation({
    mutationFn: async ({ coupleId }: StartVariables) => {
      const result = await startCoupleTimerAction(coupleId);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onMutate: async (variables: StartVariables) => {
      // Cancel first: an in-flight read would otherwise resolve after the
      // optimistic write and restore the pre-click state.
      await queryClient.cancelQueries({ queryKey: RUNNING_TIMER_KEY });
      const previous =
        queryClient.getQueryData<RunningTimerRead>(RUNNING_TIMER_KEY);
      queryClient.setQueryData<RunningTimerRead>(
        RUNNING_TIMER_KEY,
        optimisticStart(previous, variables),
      );
      return { previous };
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
    onError: (_error, _variables, context) => {
      rollback(context?.previous);
      toast('Could not start the timer', 'error');
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      const result = await stopCoupleTimerAction();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: RUNNING_TIMER_KEY });
      const previous =
        queryClient.getQueryData<RunningTimerRead>(RUNNING_TIMER_KEY);
      // Keep the offset: the next start reuses it, and dropping it would
      // briefly measure the new session against the device clock.
      queryClient.setQueryData<RunningTimerRead>(RUNNING_TIMER_KEY, {
        running: null,
        clockOffsetMs: previous?.clockOffsetMs ?? 0,
      });
      return { previous };
    },
    onSuccess: (stopped) => {
      invalidate(stopped?.entry.couple_id);
      // The dialog waits for the real row: annotating needs the entry id
      // the insert returns, and an optimistic one could not be saved.
      if (stopped) setPending(stopped);
    },
    onError: (_error, _variables, context) => {
      rollback(context?.previous);
      toast('Could not stop the timer', 'error');
    },
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
      start: (coupleId: string, coupleName?: string) => {
        if (shadowing) return;
        startMutation.mutate({ coupleId, coupleName });
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

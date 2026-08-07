/**
 * The floating "still timing" pill.
 *
 * Fixed to the viewport's top-right on every dashboard page while a
 * timer runs, so a forgotten timer is always in sight. It cannot be
 * dismissed: that is the point. It yields only to a surface that owns
 * the same corner (see `claimSurface` in the provider).
 *
 * @module components/time-tracking/timer-pill
 */
'use client';

import { Square, Timer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { entryDurationMs, formatElapsed } from '@/lib/time-tracking/format';

import { useTimerSurface } from './timer-provider';
import { useTimerTick } from './use-timer';

export interface TimerPillProps {
  /** True while another surface owns the timer control. */
  hidden: boolean;
}

export function TimerPill({ hidden }: TimerPillProps) {
  const { shadowing, running, clockOffsetMs, stop } = useTimerSurface();
  const active = Boolean(running) && !hidden && !shadowing;
  const nowMs = useTimerTick(active, clockOffsetMs);

  if (!active || !running) return null;

  return (
    <div
      data-testid="timer-pill"
      className="fixed right-3 top-16 z-[90] flex items-center gap-2.5 rounded-control border border-border bg-card px-2.5 py-1.5 shadow-lg md:top-3"
    >
      <Timer size={14} strokeWidth={1.5} className="shrink-0 text-text-muted" />
      <div className="min-w-0">
        <p className="max-w-[7.5rem] truncate text-body text-text sm:max-w-[10rem]">
          {running.couple_name}
        </p>
        <p className="font-mono text-body tabular-nums text-text">
          {formatElapsed(entryDurationMs(running.entry, nowMs))}
        </p>
      </div>
      <Button
        variant="secondary"
        onClick={stop}
        aria-label="Stop timing"
      >
        <Square size={11} strokeWidth={1.5} />
        Stop
      </Button>
    </div>
  );
}

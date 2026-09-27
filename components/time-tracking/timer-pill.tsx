/**
 * The floating "still timing" pill.
 *
 * Fixed to the viewport's top-right on every dashboard page while a
 * timer runs, so a forgotten timer is always in sight. It cannot be
 * dismissed: that is the point. It yields only to a surface that owns
 * the same corner (see `claimSurface` in the provider), and it docks
 * below a page header that registered itself with `useTimerPillAnchor`,
 * so it never sits on that header's controls (the workflow canvas's Turn
 * on / Turn off, Phase 6 live check B1).
 *
 * @module components/time-tracking/timer-pill
 */
'use client';

import { Square, Timer } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { entryDurationMs, formatElapsed } from '@/lib/time-tracking/format';

import { useTimerSurface } from './timer-provider';
import { useTimerTick } from './use-timer';

export interface TimerPillProps {
  /** True while another surface owns the timer control. */
  hidden: boolean;
  /** A header the pill must sit below, or null to keep its corner. */
  anchor?: HTMLElement | null;
}

/** Space between the anchor's bottom edge and the pill, in px. */
const ANCHOR_GAP = 8;

/**
 * Keeps `--timer-pill-top` on the pill at the anchor's bottom edge plus
 * a gap, re-measured when the header resizes (it wraps on a phone) or
 * the window does. A CSS variable rather than a style prop: the value is
 * a measurement, and the class that reads it stays in Tailwind.
 */
function useDockBelow(pill: React.RefObject<HTMLDivElement | null>, anchor: HTMLElement | null, active: boolean) {
  useLayoutEffect(() => {
    const el = pill.current;
    if (!el || !anchor || !active) return;
    const place = () =>
      el.style.setProperty('--timer-pill-top', `${Math.ceil(anchor.getBoundingClientRect().bottom) + ANCHOR_GAP}px`);
    place();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    observer?.observe(anchor);
    window.addEventListener('resize', place);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [pill, anchor, active]);
}

/** The pill. See the module comment. */
export function TimerPill({ hidden, anchor = null }: TimerPillProps) {
  const { shadowing, running, clockOffsetMs, stop } = useTimerSurface();
  const active = Boolean(running) && !hidden && !shadowing;
  const nowMs = useTimerTick(active, clockOffsetMs);
  const ref = useRef<HTMLDivElement>(null);
  useDockBelow(ref, anchor, active);

  if (!active || !running) return null;

  return (
    <div
      ref={ref}
      data-testid="timer-pill"
      className={`fixed right-3 z-[90] flex items-center gap-2.5 rounded-control border border-border bg-card px-2.5 py-1.5 shadow-lg ${
        anchor ? 'top-[var(--timer-pill-top)]' : 'top-16 md:top-3'
      }`}
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

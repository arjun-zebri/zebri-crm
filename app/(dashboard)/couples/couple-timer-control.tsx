/**
 * The start/stop clock in the Couple Profile header.
 *
 * While the profile overlay is open it, not the floating pill, is the
 * timer control: the pill is fixed to the viewport's top-right, which is
 * exactly where this overlay puts its close button.
 *
 * Three states:
 * - nothing running: a ghost clock button that starts this couple;
 * - running for this couple: an active button showing elapsed, which stops;
 * - running for another couple: an informational chip naming that couple,
 *   beside a button that starts this one. Starting stops the other, so
 *   switching couples stays a single click.
 *
 * @module app/(dashboard)/couples/couple-timer-control
 */
'use client';

import { Square, Timer } from 'lucide-react';

import { useTimerSurface } from '@/components/time-tracking/timer-provider';
import { useTimerTick } from '@/components/time-tracking/use-timer';
import { Tooltip } from '@/components/ui/tooltip';
import { entryDurationMs, formatElapsed } from '@/lib/time-tracking/format';

/**
 * Shared timer state for one couple's header, used by both the desktop
 * control and the mobile overflow row so they can never disagree.
 */
export function useCoupleTimerControl(coupleId: string) {
  const { shadowing, running, clockOffsetMs, isRunningFor, start, stop } =
    useTimerSurface();
  const runningHere = isRunningFor(coupleId);
  const nowMs = useTimerTick(Boolean(running) && !shadowing, clockOffsetMs);
  const elapsed = running
    ? formatElapsed(entryDurationMs(running.entry, nowMs))
    : null;

  return {
    shadowing,
    runningHere,
    elapsed,
    /** Name of the couple being timed, when it is not this one. */
    otherCoupleName: running && !runningHere ? running.couple_name : null,
    label: runningHere ? 'Stop timing' : 'Start timing',
    toggle: () => (runningHere ? stop() : start(coupleId)),
  };
}

export interface CoupleTimerControlProps {
  coupleId: string;
}

/** Desktop inline control. Renders nothing during a shadow session. */
export function CoupleTimerControl({ coupleId }: CoupleTimerControlProps) {
  const { shadowing, runningHere, elapsed, otherCoupleName, label, toggle } =
    useCoupleTimerControl(coupleId);

  if (shadowing) return null;

  return (
    <div className="flex items-center gap-1.5">
      {otherCoupleName ? (
        <span className="flex items-center gap-1.5 rounded-lg bg-surface-emphasis px-2 py-1 text-caption text-text-muted">
          <Timer size={12} strokeWidth={1.5} />
          <span className="max-w-[7rem] truncate">{otherCoupleName}</span>
          <span className="font-mono tabular-nums">{elapsed}</span>
        </span>
      ) : null}
      <Tooltip label={label}>
        <button
          onClick={toggle}
          aria-label={label}
          className={`flex cursor-pointer items-center gap-1.5 rounded-lg p-1.5 transition ${
            runningHere
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
          }`}
        >
          {runningHere ? (
            <Square size={14} strokeWidth={1.5} />
          ) : (
            <Timer size={16} strokeWidth={1.5} />
          )}
          {runningHere ? (
            <span className="font-mono text-caption tabular-nums">{elapsed}</span>
          ) : null}
        </button>
      </Tooltip>
    </div>
  );
}

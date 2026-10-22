'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { IconCircle, type IconCircleIcon } from '@/components/ui-v2/icon-circle';
import { AlertIcon, CheckIcon, SpinnerIcon } from '@/components/ui-v2/icons';

/**
 * What the BDM lodgement band's three snapshots share (`bdm-snap-*.tsx`):
 * the props each takes, the ticking clock their plays run on, the easing
 * they move with, and the one layout all three are built from (founder,
 * 2026-10-19: the three steps "styled very differently", a form, a big
 * number and a receipt): a `Status` line at the top that turns green as
 * the step is done, over `Rows` of label and value. The same answer moves
 * through the same rows, card to card.
 *
 * @module app/design-system/v2/pages/website/bdm-snap-parts
 */

/** Every snapshot: playing from the start (remounted to play again), or finished. */
export interface SnapProps {
  playing: boolean;
  done: boolean;
}

/** Fades and colour changes. */
export const EASE = 'transition duration-700 ease-out motion-reduce:transition-none';
/** Arrivals: a slight overshoot, so a row settles rather than stops. */
export const SPRING = 'transition duration-700 ease-[cubic-bezier(0.34,1.4,0.64,1)] motion-reduce:transition-none';
/** Two things in one grid cell, swapped by opacity. */
export const STACK = 'col-start-1 row-start-1';

/** Steps through `times` (ms from the start) while `on`: 0 before the first, then 1, 2, … */
export function useBeats(on: boolean, times: number[]): number {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    if (!on) return;
    const ids = times.map((ms, i) => window.setTimeout(() => setBeat(i + 1), ms));
    return () => ids.forEach((id) => window.clearTimeout(id));
    // The times are a constant per caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);
  return beat;
}

/** Where a step stands: under way (a spinner or the step's glyph), needing a fix, or done. */
export type StatusState = 'idle' | 'busy' | 'warn' | 'done';

/**
 * A card's status line, in the same place and style on all three: a
 * circle (the step's glyph, a spinner, amber, or a green check) beside a
 * title and one quiet line. Done is green, so the three end as one row
 * of ticks.
 */
export function Status({ state, icon, title, detail }: { state: StatusState; icon: IconCircleIcon; title: string; detail: string }) {
  const tone = state === 'done' ? 'grass' : state === 'warn' ? 'warning' : 'neutral';
  return (
    <div className="flex items-center gap-3">
      <IconCircle icon={state === 'busy' ? undefined : state === 'done' ? CheckIcon : state === 'warn' ? AlertIcon : icon} tone={tone}>
        {state === 'busy' ? <SpinnerIcon aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : undefined}
      </IconCircle>
      <div className="min-w-0">
        <p className={`type-label ${state === 'done' ? 'text-grass-800' : 'text-zebra-950'}`}>{title}</p>
        <p className="truncate type-body text-zebra-500">{detail}</p>
      </div>
    </div>
  );
}

/** The rows under a status: hairlines between, the same on every card. */
export function Rows({ children }: { children: ReactNode }) {
  return <dl className="mt-4 border-t border-hairline">{children}</dl>;
}

/** One row: the question's name in grey, its answer on the right; `children` sit under it (a refusal). */
export function Row({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
  return (
    // Each row draws its own rule.
    <div className="border-b border-hairline py-2.5">
      <div className="flex items-baseline justify-between gap-4 type-body">
        <dt className="text-zebra-500">{label}</dt>
        {/* An empty answer holds a space: with no text it has no baseline, and the row grew 5px taller. */}
        <dd className="min-h-5 text-right text-zebra-950">{value || '\u00a0'}</dd>
      </div>
      {children}
    </div>
  );
}

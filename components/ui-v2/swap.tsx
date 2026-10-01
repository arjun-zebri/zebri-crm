'use client';

import { createContext, memo, useEffect, useState, type ReactNode } from 'react';

/**
 * Design system v2 swap (preview): shows one of several states of a
 * control in the same spot, and animates the hand-over when `active`
 * changes. The new state sharpens and settles from 94% (`swap-in`,
 * 320ms, with a 60ms lead so the two cross rather than stack); the old
 * one softens and fades (`swap-out`, 200ms) and then unmounts.
 *
 * States are laid in one grid cell, so the box is as big as the largest
 * state present and nothing around it shifts mid-swap. Only the active
 * state is mounted at rest, so an entrance animation inside it (a tick
 * drawing itself) plays when it arrives, not on page load. The first
 * render does not animate. Leaving states are frozen as they were when
 * they left, `inert`, and hidden from assistive tech. All motion is dropped under reduced motion.
 *
 * @example
 * ```tsx
 * <Swap
 *   active={added ? 'added' : 'add'}
 *   states={{ add: <Button onClick={add}>Add</Button>, added: <Badge>Added</Badge> }}
 *   className="justify-items-end"
 * />
 * ```
 *
 * @module components/ui-v2/swap
 */

/**
 * Whether the enclosing Swap state just arrived (true) or was there from
 * the first render (false); `undefined` outside any Swap. `DrawnCheck`
 * reads it so a tick that is already on screen when a view opens stays
 * still, and only draws at the moment of the hand-over.
 */
export const SwapAppearContext = createContext<boolean | undefined>(undefined);

export interface SwapProps<K extends string> {
  /** The state to show. */
  active: K;
  /** Every state's content. Only the active one (and one leaving) render. */
  states: Record<K, ReactNode>;
  /** Classes on the grid, e.g. `justify-items-end` to right-align states. */
  className?: string | undefined;
}

interface Layer<K> {
  key: K;
  leaving: boolean;
  appear: boolean;
}

/** How long a leaving state stays mounted: the length of `swap-out`. */
const OUT_MS = 200;

/**
 * When an arrived state counts as settled: past `swap-in` and a
 * `DrawnCheck` inside it (550ms), with margin.
 */
const SETTLE_MS = 800;

/**
 * A state's content, which stops updating once it starts to leave. The
 * change that sends a state away often also changes that state's props
 * in the same render (a spinner clears as the block lands), and without
 * this the fading copy flashed its label back before it went.
 */
const Frozen = memo(
  function Frozen({ node }: { node: ReactNode; frozen: boolean }) {
    return node;
  },
  (_, next) => next.frozen,
);

/** v2 swap. See {@link SwapProps}. */
export function Swap<K extends string>({ active, states, className }: SwapProps<K>) {
  const [layers, setLayers] = useState<Layer<K>[]>([{ key: active, leaving: false, appear: false }]);
  // Adjusted during render (React's pattern for state that follows a
  // prop), so the new state is on screen in the same frame as the change.
  const [last, setLast] = useState(active);
  if (active !== last) {
    setLast(active);
    setLayers((ls) => [
      ...ls.filter((l) => l.key !== active).map((l) => ({ ...l, leaving: true })),
      { key: active, leaving: false, appear: true },
    ]);
  }
  useEffect(() => {
    if (!layers.some((l) => l.leaving)) return;
    const t = window.setTimeout(() => setLayers((ls) => ls.filter((l) => !l.leaving)), OUT_MS);
    return () => window.clearTimeout(t);
  }, [layers]);
  // Settle arrivals once their motion is done. Without this a closed and
  // reopened <dialog> (display: none, then shown) restarts the entrance
  // animations still attached, replaying every tick on open.
  useEffect(() => {
    if (!layers.some((l) => l.appear && !l.leaving)) return;
    const t = window.setTimeout(
      () => setLayers((ls) => ls.map((l) => (l.leaving ? l : { ...l, appear: false }))),
      SETTLE_MS,
    );
    return () => window.clearTimeout(t);
  }, [layers]);

  return (
    <span className={`inline-grid${className ? ` ${className}` : ''}`}>
      {layers.map((l) => (
        <span
          key={l.key}
          inert={l.leaving}
          aria-hidden={l.leaving || undefined}
          className={`col-start-1 row-start-1 flex ${
            l.leaving
              ? 'pointer-events-none motion-safe:animate-[swap-out_200ms_ease-in_both]'
              : l.appear
                ? 'motion-safe:animate-[swap-in_320ms_cubic-bezier(0.2,0.7,0.2,1)_60ms_both]'
                : ''
          }`}
        >
          <SwapAppearContext.Provider value={l.appear}>
            <Frozen node={states[l.key]} frozen={l.leaving} />
          </SwapAppearContext.Provider>
        </span>
      ))}
    </span>
  );
}

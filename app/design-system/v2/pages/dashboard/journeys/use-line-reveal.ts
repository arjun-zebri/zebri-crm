import { useEffect, useState } from 'react';

/**
 * The order a journey's line plays in when a client is first shown on it
 * (the first run, straight from the booking celebration): the steps
 * already done for them tick off one by one, top down, then the steps
 * still to come rise in after them, quicker, the way a checklist is
 * marked off and the rest of it turned to. Off, everything is simply there.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/use-line-reveal
 */

/** A beat before the first tick, so the page has settled when it starts. */
const START_MS = 800;
/** Between ticks: slow enough to read each step as it is marked done. */
const TICK_MS = 1000;
/** A pause after the last tick, then the steps to come, closer together. */
const TURN_MS = 600;
/** Each rising step starts while the one before is still settling, so they flow as one cascade. */
const RISE_MS = 280;

/**
 * How many of `count` steps have played so far: step `i` has ticked (if
 * done) or risen in once the result is above `i`. `done` is how many steps
 * from the top are done. With `on` false, or under reduced motion, every
 * step has played from the start.
 */
export function useLineReveal(on: boolean, count: number, done: number): number {
  const [played, setPlayed] = useState(on ? 0 : Number.POSITIVE_INFINITY);
  useEffect(() => {
    if (!on) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const t = window.setTimeout(() => setPlayed(Number.POSITIVE_INFINITY), 0);
      return () => window.clearTimeout(t);
    }
    const at = Array.from({ length: count + 1 }, (_, i) =>
      i < done ? START_MS + i * TICK_MS : START_MS + done * TICK_MS + TURN_MS + (i - done) * RISE_MS,
    );
    const timers = at.map((ms, i) => window.setTimeout(() => setPlayed(i + 1), ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [on, count, done]);
  return played;
}

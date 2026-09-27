/**
 * Registers a page header the running-timer pill must dock below.
 *
 * The pill lives in the viewport's top-right corner, which is also where
 * a page header keeps its primary controls (the workflow canvas's Turn
 * on / Turn off). A header that passes this hook's result as its `ref`
 * becomes the pill's anchor: the pill measures the header's bottom edge
 * and sits just under it, at any width and however the header wraps
 * (Phase 6 live check, B1). Unmounting the header releases it and the
 * pill returns to its corner.
 *
 * Outside a TimerProvider it returns a no-op, so a header stays
 * renderable on its own.
 *
 * @module components/time-tracking/use-timer-pill-anchor
 */
'use client';

import { useOptionalTimerSurface } from './timer-provider';

/** A no-op anchor for trees with no timer. */
function noAnchor(): void {}

/**
 * @returns a ref callback for the header the pill must not cover
 * @example
 * const anchor = useTimerPillAnchor();
 * return <header ref={anchor}>...</header>;
 */
export function useTimerPillAnchor(): (el: HTMLElement | null) => void {
  return useOptionalTimerSurface()?.setPillAnchor ?? noAnchor;
}

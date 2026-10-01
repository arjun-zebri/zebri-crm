'use client';

import { useEffect, useState, type ReactNode } from 'react';

/**
 * Design system v2 collapse (preview, shown on `/design-system/v2`).
 *
 * Eases its content open and shut by height (the `grid-template-rows`
 * 0fr to 1fr trick, so no measuring), on one shared timeline: outgoing
 * content fades (0 to 100ms), every height moves together (100 to
 * 300ms), then incoming content fades up into its space (300 to
 * 480ms). Heights never start at different times, so when one collapse
 * shuts as another opens (a summary swapping for its detail) the total
 * does not bounce. Fading with the height instead shows the content's
 * top edge the moment the box starts to grow, clipped against the line
 * above, so it seems to drop out of it. The content stays
 * mounted, which keeps what was typed and lets two collapses swap
 * places smoothly (a summary folding as the detail opens). While shut
 * it is `inert`: out of the tab order and hidden from screen readers.
 *
 * `appear` makes a newly mounted collapse start shut and ease open, so
 * a list item can grow in; to take one out, shut it and unmount it once
 * the transition is done ({@link COLLAPSE_MS}). Everything below moves
 * with the layout as the height changes, so nothing has to be measured
 * or can land in the wrong place.
 *
 * @example
 * ```tsx
 * <Collapse open={!editing}>{summary}</Collapse>
 * <Collapse open={editing}>{editor}</Collapse>
 * <Collapse open={!leaving} appear>{row}</Collapse>
 * ```
 *
 * @module components/ui-v2/collapse
 */

/** When a shutting collapse has finished closing, in ms: safe to unmount. */
export const COLLAPSE_MS = 300;

export interface CollapseProps {
  open: boolean;
  /** Start shut on mount and ease open (a new item growing in). */
  appear?: boolean;
  children: ReactNode;
}

/** v2 collapse. See {@link CollapseProps}. */
export function Collapse({ open, appear = false, children }: CollapseProps) {
  const [mounted, setMounted] = useState(!appear);
  useEffect(() => {
    if (mounted) return;
    // Two frames: the first paints the shut state, so the second has
    // something to transition from.
    let second = 0;
    const first = requestAnimationFrame(() => (second = requestAnimationFrame(() => setMounted(true))));
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [mounted]);
  const shown = open && mounted;
  return (
    <div
      // Inert follows `open`, not the animation, so a growing item can
      // take focus straight away.
      inert={!open}
      // Height always moves in the middle beat, whichever way it goes.
      className={`grid transition-[grid-template-rows] delay-100 duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
        shown ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
      }`}
    >
      {/* min-h-0 lets the row shrink below its content; overflow-hidden
          clips it while it does. The content fades and settles 4px up
          once its space is open, and fades out before the space closes. */}
      <div
        className={`min-h-0 overflow-hidden transition-[opacity,translate] ease-out motion-reduce:transition-none ${
          shown ? 'translate-y-0 opacity-100 delay-300 duration-180' : 'translate-y-1 opacity-0 duration-100'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

'use client';

import { useContext } from 'react';

import { SwapAppearContext } from './swap';

/**
 * Design system v2 drawn check (preview): a tick whose stroke draws
 * itself when it mounts (the `tick-draw` keyframe, 400ms after a 150ms
 * beat), for the moment something is done: Added, Connected, All added.
 * Inside a {@link Swap} it draws only when that state arrives by a
 * hand-over; one already there when the view opens (an added block in
 * a freshly opened dialog) sits still. Outside a Swap it draws on mount.
 * Static under reduced motion.
 *
 * @example
 * ```tsx
 * <Badge size="control" tone="brand"><DrawnCheck className="size-3.5" />Added</Badge>
 * ```
 *
 * @module components/ui-v2/drawn-check
 */

/** v2 drawn check. Size and colour come from `className` (`currentColor`). */
export function DrawnCheck({ className }: { className: string }) {
  const appear = useContext(SwapAppearContext);
  const draw = appear !== false;
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>
      <path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray={24} className={draw ? 'motion-safe:animate-[tick-draw_400ms_cubic-bezier(0.65,0,0.35,1)_150ms_both]' : undefined} />
    </svg>
  );
}

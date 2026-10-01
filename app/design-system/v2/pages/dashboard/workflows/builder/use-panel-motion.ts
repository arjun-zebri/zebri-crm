'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * The step panel's arrival and exit beside the story, on transforms
 * only. Animating the column's width re-laid-out the whole story and
 * repainted the glass on every frame, which read as cheap and juddery.
 * Instead the column snaps to its final size in one layout, and the
 * story is played back from where it was (FLIP) while the panel slides
 * in, both on the same soft-landing curve. Closing reverses it: the
 * panel slides out first, then the column goes and the story glides home.
 *
 * `mounted` stays true through the exit so the caller keeps the column
 * (and the panel's content) on screen until the panel has left.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/builder/use-panel-motion
 */

// Fast off the mark, long gentle landing: the curve iOS sheets use.
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const IN_MS = 380;
const OUT_MS = 160;

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface PanelMotion {
  /** Keep the side column rendered: open, or still leaving. */
  mounted: boolean;
  /** The column that moves aside (translated as a whole). */
  columnRef: React.RefObject<HTMLDivElement | null>;
  /** The centred content inside it, measured for where it sits. */
  anchorRef: React.RefObject<HTMLDivElement | null>;
  panelRef: React.RefObject<(HTMLElement & HTMLDivElement) | null>;
}

/** Drives the panel motion. See {@link PanelMotion}. */
export function usePanelMotion(open: boolean): PanelMotion {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  const columnRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<(HTMLElement & HTMLDivElement) | null>(null);
  // Layout x of the story before the column changed. offsetLeft ignores
  // transforms, so a glide in flight never skews the next measurement.
  const lastX = useRef<number | null>(null);
  const exit = useRef<Animation | null>(null);

  // The column came or went: play the story back from where it was.
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const column = columnRef.current;
    if (!anchor || !column) return;
    const x = anchor.offsetLeft;
    const dx = lastX.current === null ? 0 : lastX.current - x;
    lastX.current = x;
    if (Math.abs(dx) < 1 || reduced()) return;
    column.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: IN_MS, easing: EASE });
  }, [mounted]);

  // A resize moves the story without a toggle; keep the baseline true.
  useEffect(() => {
    const sync = () => {
      if (anchorRef.current) lastX.current = anchorRef.current.offsetLeft;
    };
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (open) {
      exit.current?.cancel();
      exit.current = null;
      if (panel && !reduced())
        panel.animate([{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'none' }], { duration: IN_MS, easing: EASE });
      return;
    }
    if (!mounted) return;
    if (!panel || reduced()) return setMounted(false);
    const a = panel.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(24px)' }], {
      duration: OUT_MS,
      easing: 'cubic-bezier(0.4, 0, 1, 1)',
      fill: 'forwards',
    });
    exit.current = a;
    // A reopen cancels the exit, which rejects `finished`; that is fine.
    a.finished.then(() => setMounted(false), () => {});
    // `mounted` is read, not a trigger: only a change of `open` animates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return { mounted, columnRef, anchorRef, panelRef };
}

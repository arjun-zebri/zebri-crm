'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * Follows the proposal preview as the MC scrolls it, for the side
 * column's attention chart: which section is being read (to bold that
 * row) and how far down the page the reader is, in rows (to place the
 * chart's line). The page's sections are the preview's `article >
 * section` blocks: the cover first, then one per reading row in order
 * (Welcome, Video hello, How it works, Packages, Their words, Accept).
 *
 * The reading point is 40% of the way down the scroller's window, where
 * the eye rests; at the very bottom of the scroll it snaps to the end,
 * so the last section can be reached however short it is. The cover
 * reads as the start of Welcome. Measured on scroll and resize, once a
 * frame at most.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/modal/use-reading-position
 */

/** Where the reader is: the row being read and the line's place in rows. */
export interface ReadingPosition {
  row: number;
  at: number;
}

// The cover counts as the start of Welcome, so the chart is on Welcome
// the moment the modal opens rather than showing nothing.
const START: ReadingPosition = { row: 0, at: 0 };

/** Measures the reading position inside `el`; `null` when `el` does not scroll on its own. */
function measure(el: HTMLElement): ReadingPosition | null {
  if (el.scrollHeight <= el.clientHeight + 1) return null;
  const sections = [...el.querySelectorAll<HTMLElement>('article > section')];
  if (sections.length < 2) return null;
  const box = el.getBoundingClientRect();
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
  const probe = atBottom ? Number.POSITIVE_INFINITY : box.top + box.height * 0.4;
  let i = 0;
  sections.forEach((s, n) => {
    if (s.getBoundingClientRect().top <= probe) i = n;
  });
  const rect = sections[i]!.getBoundingClientRect();
  const through = atBottom ? 1 : Math.min(Math.max((probe - rect.top) / rect.height, 0), 1);
  // Section 0 is the cover, before the first reading row.
  return i === 0 ? START : { row: i - 1, at: i - 1 + through };
}

/**
 * Reading position for the preview inside `scroller`, or `null` where
 * the preview does not scroll on its own (phones, where the whole dialog
 * scrolls and the chart sits below the preview, so it keeps its default
 * bold row and no line). `key` (the open proposal's id, `null` while
 * closed) starts it afresh for each proposal.
 */
export function useReadingPosition(scroller: RefObject<HTMLElement | null>, key: string | null): ReadingPosition | null {
  // Kept with the key it was measured for, so another proposal starts at the top.
  const [state, setState] = useState<{ key: string | null; pos: ReadingPosition | null }>({ key: null, pos: START });

  useEffect(() => {
    const el = scroller.current;
    if (!el || key === null) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const pos = measure(el);
        setState((s) =>
          s.key === key && (s.pos === pos || (s.pos && pos && s.pos.row === pos.row && Math.abs(s.pos.at - pos.at) < 0.01)) ? s : { key, pos },
        );
      });
    };
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [scroller, key]);

  return state.key === key ? state.pos : START;
}

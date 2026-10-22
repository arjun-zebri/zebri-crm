'use client';

import { useLayoutEffect, type RefObject } from 'react';

import { autoHeight, type CanvasPage } from './model';
import type { Canvas } from './use-canvas';

/**
 * Keeps each text's `h` equal to the height its words take on the page,
 * as Canva's text boxes grow and shrink with their text. Measured from
 * the drawing (layout pixels, untouched by the zoom's transform), on every
 * change and whenever a face finishes loading and reflows the words, so
 * selection frames, snapping and "line up with the page" use the real box.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/use-auto-height
 */
export function useAutoHeight(root: RefObject<HTMLElement | null>, page: CanvasPage, canvas: Canvas) {
  const { measure: record } = canvas;
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const texts = page.elements.filter(autoHeight);
    const measure = () => {
      const heights: Record<string, number> = {};
      for (const el of texts) {
        const box = node.querySelector<HTMLElement>(`[data-element="${el.id}"]`);
        // Stops the loop: a height already recorded is not written again.
        if (box && box.offsetHeight !== el.h) heights[el.id] = box.offsetHeight;
      }
      if (Object.keys(heights).length) record(heights);
    };
    measure();
    const ro = new ResizeObserver(measure);
    for (const el of texts) {
      const box = node.querySelector(`[data-element="${el.id}"]`);
      if (box) ro.observe(box);
    }
    return () => ro.disconnect();
  }, [root, page, record]);
}

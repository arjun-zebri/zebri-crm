'use client';

import { useRef, useState, type PointerEvent } from 'react';

import { resize, snap, bounds, type Guide, type Handle, type Rect } from './geometry';
import type { CanvasPage } from './model';
import type { Canvas } from './use-canvas';

/**
 * Dragging on the canvas: moving the selection, or resizing one element
 * by a handle. Pointer movement is in screen pixels, so it is divided by
 * the zoom to land in page pixels; moves snap to the page and to the other
 * elements (within 6 screen pixels, whatever the zoom), and the guides it
 * snapped to are returned for the page to draw. Every step is a live
 * change (one history entry per gesture); letting go settles it.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/use-gesture
 */

interface Start {
  px: number;
  py: number;
  /** Each moving element's box when the gesture began. */
  from: Map<string, Rect>;
  handle: Handle | null;
  keepRatio: boolean;
}

/** Snapping reach, in screen pixels. */
const REACH = 6;

/** The drag handling for one page at `zoom`. */
export function useGesture(canvas: Canvas, page: CanvasPage, zoom: number) {
  const start = useRef<Start | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);

  /** Starts moving `ids` (or resizing the one id by `handle`) from this pointer. */
  function begin(e: PointerEvent, ids: string[], handle: Handle | null = null) {
    const from = new Map<string, Rect>();
    for (const el of page.elements) if (ids.includes(el.id)) from.set(el.id, { x: el.x, y: el.y, w: el.w, h: el.h });
    const one = page.elements.find((el) => el.id === ids[0]);
    start.current = { px: e.clientX, py: e.clientY, from, handle, keepRatio: one?.kind === 'image' || one?.kind === 'logo' };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function move(e: PointerEvent) {
    const s = start.current;
    if (!s) return;
    const dx = (e.clientX - s.px) / zoom;
    const dy = (e.clientY - s.py) / zoom;
    if (s.handle) {
      const [id, r] = [...s.from][0]!;
      canvas.update([id], resize(r, s.handle, dx, dy, s.keepRatio && !e.shiftKey), true);
      return;
    }
    // The selection moves as one box: snap that box, then shift every element by the same amount.
    const box = bounds([...s.from.values()]);
    const others = page.elements.filter((el) => !s.from.has(el.id));
    const snapped = e.altKey ? { rect: { ...box, x: box.x + dx, y: box.y + dy }, guides: [] } : snap({ ...box, x: box.x + dx, y: box.y + dy }, others, page, REACH / zoom);
    const ox = snapped.rect.x - box.x;
    const oy = snapped.rect.y - box.y;
    setGuides(snapped.guides);
    canvas.update([...s.from.keys()], (el) => {
      const r = s.from.get(el.id)!;
      return { x: Math.round(r.x + ox), y: Math.round(r.y + oy) };
    }, true);
  }

  function end() {
    if (!start.current) return;
    start.current = null;
    setGuides([]);
    canvas.settle();
  }

  return { begin, move, end, guides, active: () => start.current !== null };
}

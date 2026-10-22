'use client';

import type { Editor } from '@tiptap/react';
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * Where the text bar sits. It stays still while the same words are
 * formatted (founder, 2026-10-10: "making changes to the text shouldn't
 * move the popover"): production's bubble re-places itself under the
 * words whenever they change size, so once a selection's words are
 * changed the row holds the spot it had just before, and only a new
 * selection lets it follow the bubble again.
 *
 * And moving it by its grip (founder, 2026-10-10: "you should be
 * able to drag and move the text popover"). Production's bubble places
 * the bar under the selected words; once the MC drags it, it stays at
 * that spot on screen for every selection after, as the section bar
 * stays where it was put. The bubble still owns the outer element (and
 * moves it to each selection), so the row is shifted inside it, by the
 * gap between where the bubble is and where the row should be, kept up
 * each frame.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/text-bar/use-drag-bar
 */

/** A spot on screen, in viewport pixels. */
export interface ScreenPoint {
  x: number;
  y: number;
}

/** The row's ref and the grip's pointer handler, for the bar over `editor`'s selection, left at `pinned` (null: under the words). */
export function useDragBar(editor: Editor, pinned: ScreenPoint | null, onPin: (at: ScreenPoint) => void) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    let frame = 0;
    let words = '';
    let doc = editor.state.doc;
    let holding = false;
    let held: ScreenPoint = { x: 0, y: 0 };
    const tick = () => {
      const box = el.parentElement?.getBoundingClientRect();
      if (box) {
        const { from, to } = editor.state.selection;
        // A new selection follows the bubble; a change to the same words holds the bar where it was.
        if (`${from}-${to}` !== words) {
          words = `${from}-${to}`;
          holding = false;
        } else if (editor.state.doc !== doc) holding = true;
        doc = editor.state.doc;
        if (!holding) held = { x: box.left, y: box.top };
        const at = pinned ?? held;
        el.style.transform = `translate(${Math.round(at.x - box.left)}px, ${Math.round(at.y - box.top)}px)`;
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [editor, pinned]);

  const grab = (e: ReactPointerEvent<HTMLElement>) => {
    const el = row.current;
    if (!el) return;
    // Kept off the words' focus, so the selection, and with it the bar, stays.
    e.preventDefault();
    const start = el.getBoundingClientRect();
    const from = { x: e.clientX, y: e.clientY };
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent) =>
      onPin({
        x: Math.min(Math.max(0, start.left + m.clientX - from.x), window.innerWidth - start.width),
        y: Math.min(Math.max(0, start.top + m.clientY - from.y), window.innerHeight - start.height),
      });
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  };

  return { row, grab };
}

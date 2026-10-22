'use client';

import { useEffect } from 'react';

import type { Canvas } from './use-canvas';

/**
 * The editor's keyboard, as Canva's: Delete or Backspace removes the
 * selection (required parts stay), arrows nudge it a pixel (Shift for
 * ten), Cmd/Ctrl+D duplicates, Cmd/Ctrl+Z undoes and Shift+Cmd/Ctrl+Z
 * (or Ctrl+Y) redoes, Escape clears the selection. Keys typed into a
 * field or into text being edited are left alone.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/use-canvas-keys
 */

/** Whether a key event belongs to something being typed into. */
const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.isContentEditable ||
    ['TEXTAREA', 'SELECT'].includes(t.tagName) ||
    // A slider or a checkbox takes no words: Cmd+Z there still undoes.
    (t instanceof HTMLInputElement && !['range', 'checkbox', 'radio', 'button'].includes(t.type)));

/**
 * Whether a key event comes from the toolbar or one of its cards. Escape
 * there closes the card, not the selection, and arrows move between
 * choices, not the element; only undo and redo still reach the canvas.
 */
const inTools = (t: EventTarget | null) =>
  t instanceof Element && !!t.closest('[role="toolbar"], [data-radix-popper-content-wrapper]');

/** Wires the keyboard to `canvas` while `active`. */
export function useCanvasKeys(canvas: Canvas, active: boolean) {
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (typing(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const ids = canvas.selected;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        return e.shiftKey ? canvas.redo() : canvas.undo();
      }
      if (mod && e.key.toLowerCase() === 'y') return (e.preventDefault(), canvas.redo());
      if (!ids.length || inTools(e.target)) return;
      if (e.key === 'Escape') {
        // Deselects only: inside a dialog, Escape would otherwise also close it.
        e.preventDefault();
        return canvas.select([]);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') return (e.preventDefault(), canvas.remove(ids));
      if (mod && e.key.toLowerCase() === 'd') return (e.preventDefault(), canvas.duplicate(ids));
      const step = e.shiftKey ? 10 : 1;
      const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (move) {
        e.preventDefault();
        canvas.update(ids, (el) => ({ x: el.x + move[0]!, y: el.y + move[1]! }));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canvas, active]);
}

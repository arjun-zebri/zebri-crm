'use client';

import { useEffect } from 'react';

/**
 * Tells the v2 styles whether focus came from the mouse or the keyboard.
 *
 * Chrome's `:focus-visible` heuristic also fires on clicks: after any
 * key press (typing, Escape out of a dialog) or when a dialog or menu
 * moves focus by script. That painted green rings, and Chrome's blue
 * default outline, on things the user had only clicked. This sets
 * `data-focus="pointer"` on `<html>` from a pointer press until the next
 * navigation key (Tab, arrows, Escape; typing in a field does not
 * count), and the `focus-key:` variant in globals.css only applies while
 * it is unset, so the rings show only for people moving by keyboard.
 *
 * @module app/design-system/v2/focus-modality
 */

/** Renders nothing; wires the listeners for the life of the v2 pages. */
export function FocusModality() {
  useEffect(() => {
    const root = document.documentElement;
    const pointer = () => root.setAttribute('data-focus', 'pointer');
    const key = (e: KeyboardEvent) => {
      // Typing in a field is not navigating; Tab out of one is.
      const t = e.target as HTMLElement | null;
      const typing = t?.closest('input, textarea, select, [contenteditable="true"]');
      if (e.key === 'Tab' || (!typing && !e.metaKey && !e.ctrlKey)) root.removeAttribute('data-focus');
    };
    pointer();
    document.addEventListener('pointerdown', pointer, true);
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('pointerdown', pointer, true);
      document.removeEventListener('keydown', key, true);
      root.removeAttribute('data-focus');
    };
  }, []);
  return null;
}

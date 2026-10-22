'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether the editor is on a phone, where it edits light (2026-10-09):
 * words and data (times, questions, prices) change, the layout and the
 * look do not. No section handles, no "+", no dragging, no brand panel;
 * the text bubble keeps bold, italic and link; a section edited in a
 * panel opens in a sheet. Phones are for fixing a detail on the night,
 * not for laying out a document.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/phone/use-light-edit
 */

const QUERY = '(max-width: 767px)';

function subscribe(onChange: () => void) {
  const list = window.matchMedia(QUERY);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}

/** True on a phone-width screen. */
export function useLightEdit(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

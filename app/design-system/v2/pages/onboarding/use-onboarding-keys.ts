'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Keyboard feel for the onboarding: each step lands with the cursor in
 * its first field, and Cmd/Ctrl+Enter continues from anywhere.
 *
 * Plain Enter never continues: it belongs to the field it is pressed in
 * (adding an inclusion, say), and a stray Enter must not skip a step the
 * MC is still filling in. The footer's Continue button blocks it too.
 *
 * Autofocus only runs with a fine pointer (mouse or trackpad). On a
 * phone it would throw the keyboard up over the step before the MC has
 * read it.
 *
 * @module app/design-system/v2/pages/onboarding/use-onboarding-keys
 */

const FIELDS =
  '[data-autofocus], input:not([type=file]):not([type=color]):not([type=checkbox]):not([disabled]), select, textarea';

export function useOnboardingKeys(root: RefObject<HTMLElement | null>, step: number, onNext: () => void) {
  useEffect(() => {
    if (!window.matchMedia?.('(pointer: fine)').matches) return;
    const scope = root.current?.querySelector(`[data-step="${step}"]`);
    const target = scope?.querySelector<HTMLElement>('[data-autofocus]') ?? scope?.querySelector<HTMLElement>(FIELDS);
    target?.focus({ preventScroll: true });
  }, [root, step]);

  // Cmd/Ctrl+Enter listens on the window, not the panel: after a control
  // that had focus disappears (a dismissed card, a removed row) focus falls
  // to <body>, outside the panel, and "from anywhere" must still work.
  const latest = useRef(onNext);
  useEffect(() => {
    latest.current = onNext;
  });
  useEffect(() => {
    function onWindowKey(e: globalThis.KeyboardEvent) {
      if (e.key !== 'Enter' || e.isComposing || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      latest.current();
    }
    window.addEventListener('keydown', onWindowKey);
    return () => window.removeEventListener('keydown', onWindowKey);
  }, []);
}

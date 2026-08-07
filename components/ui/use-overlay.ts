'use client';

import { useEffect, useRef } from 'react';

/**
 * Shared behaviour for every overlay surface: Modal, SidePanel and
 * ConfirmDialog.
 *
 * Before this existed, each of the three implemented (or forgot to
 * implement) Escape-to-close and body-scroll locking on its own.
 * ConfirmDialog had neither, so a delete confirmation could not be
 * dismissed with the keyboard and the page scrolled behind it. Sharing
 * one implementation is what stops that drifting apart again.
 *
 * @module components/ui/use-overlay
 */

/**
 * Depth of the overlay stack.
 *
 * Module-level rather than context so a surface can consult it without
 * being a descendant of the overlay that opened it. Only the topmost
 * overlay reacts to Escape, which is what keeps a nested dialog from
 * closing its parent along with itself.
 */
let openOverlayDepth = 0;

/**
 * How many surfaces currently want the page frozen.
 *
 * Every locker has to go through {@link useScrollLock}, including the
 * bespoke overlays that predate this module (couple profile, contact
 * profile, settings modal). Independent lockers cannot be made to work:
 * whoever releases last has no safe value to restore, so it either
 * unlocks the page while another surface is still up or leaves it frozen
 * with nothing open. A single count has one owner and one answer.
 */
let scrollLockCount = 0;

/**
 * How many overlays are open right now.
 *
 * Read this in a custom overlay that manages its own Escape handler, so
 * it can stand down while something is stacked on top of it.
 */
export function getOpenOverlayDepth(): number {
  return openOverlayDepth;
}

/** Stacking tier. Each maps to a backdrop and panel z-index. */
export type OverlayLayer = 'base' | 'nested' | 'top';

/**
 * The overlay z-index ladder, in one place.
 *
 * `top` sits above `nested` so a destructive confirmation is never
 * occluded by the modal that opened it. It also clears the popover tier
 * (`z-[90]`, see `select.tsx`) so a confirm raised from a surface with
 * an open dropdown still reads as the frontmost decision.
 *
 * Toasts deliberately stay above everything at `z-[200]`: a confirmation
 * should not hide the message telling you what just happened.
 */
export const OVERLAY_Z: Record<OverlayLayer, { backdrop: string; panel: string }> = {
  base: { backdrop: 'z-50', panel: 'z-[60]' },
  nested: { backdrop: 'z-[75]', panel: 'z-[80]' },
  top: { backdrop: 'z-[120]', panel: 'z-[130]' },
};

/**
 * Freezes page scrolling while `active`, counted across every caller.
 *
 * Use this in any surface that covers the page, not just ones built on
 * {@link useOverlay}. The lock lifts only when the last caller releases,
 * and it clears the inline style rather than writing a guessed value
 * back, so whatever the stylesheet says takes over again.
 *
 * @example
 * ```tsx
 * // A bespoke overlay that isn't built on Modal:
 * useScrollLock(Boolean(couple));
 * ```
 */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    scrollLockCount++;
    if (scrollLockCount === 1) document.body.style.overflow = 'hidden';

    return () => {
      scrollLockCount--;
      if (scrollLockCount === 0) document.body.style.removeProperty('overflow');
    };
  }, [active]);
}

export interface UseOverlayOptions {
  /** Whether the overlay is currently rendered. */
  isOpen: boolean;
  /** Called when Escape is pressed and this overlay is the topmost one. */
  onClose: () => void;
}

/**
 * Registers an open overlay: depth-aware Escape handling plus body-scroll
 * locking that only releases once the last overlay closes.
 *
 * @example
 * ```tsx
 * useOverlay({ isOpen, onClose });
 * if (!isOpen) return null;
 * ```
 */
export function useOverlay({ isOpen, onClose }: UseOverlayOptions): void {
  // Held in a ref so the effect depends on `isOpen` alone. Callers
  // routinely pass an inline arrow for `onClose`; depending on it
  // directly would tear down and re-register on every parent render,
  // reshuffling this overlay's position in the stack mid-life.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Scrolling is handled by the shared count, so bespoke overlays that
  // also lock can interleave with this one safely.
  useScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;

    openOverlayDepth++;
    const myDepth = openOverlayDepth;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openOverlayDepth === myDepth) onCloseRef.current();
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      openOverlayDepth--;
    };
  }, [isOpen]);
}

/**
 * Backdrop click-to-dismiss that ignores drags which started inside the
 * panel.
 *
 * Selecting text in an input and releasing outside it makes the browser
 * fire `click` on the nearest common ancestor, which is the backdrop
 * wrapper. Without the press check that would close the overlay and
 * discard the user's work.
 *
 * Spread the returned handlers onto both the backdrop and the centring
 * wrapper.
 */
export function useBackdropDismiss(onClose: () => void) {
  const pressedOnBackdrop = useRef(false);

  return {
    onMouseDown: (e: React.MouseEvent) => {
      pressedOnBackdrop.current = e.target === e.currentTarget;
    },
    onClick: (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && pressedOnBackdrop.current) onClose();
      pressedOnBackdrop.current = false;
    },
  };
}

'use client';

import { useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * The non-modal form of the v2 `Dialog` (`modal={false}`): the same card
 * over the same dimmed page, but drawn as a layer on the page rather than
 * in the browser's top layer, so nothing outside it goes inert. For a
 * dialog hosting something that portals its own floating parts to
 * `<body>`, which a modal dialog draws underneath and makes unclickable:
 * production's proposal editor (its text bar, its popovers, its confirm
 * dialogs). The layer sits at z-20, under every floating part (z-30 and
 * up). Escape still closes it, unless something inside used the key
 * first (a section let go, a menu shut) or it came from a dialog opened
 * over it. Focus is not trapped; the editor owns its own keys.
 *
 * @module components/ui-v2/dialog-layer
 */

export interface DialogLayerProps {
  open: boolean;
  onClose: () => void;
  'aria-labelledby': string;
  /** The `<dialog>`'s size classes, from `Dialog`. */
  boxClass: string;
  /** The card inside it, from `Dialog`. */
  children: ReactNode;
}

/** Nothing to subscribe to: whether this is the browser never changes. */
const noSubscribe = () => () => {};

/** The layer. See {@link DialogLayerProps}. */
export function DialogLayer({ open, onClose, boxClass, children, ...aria }: DialogLayerProps) {
  // `document` only exists in the browser: false on the server, true once hydrated.
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
  if (!open || !inBrowser) return null;
  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    // Only its own Escape: one inside a dialog over it, or a popover portalled out of it, is theirs.
    if ((e.target as HTMLElement).closest('dialog') !== e.currentTarget) return;
    e.preventDefault();
    onClose();
  };
  return createPortal(
    <div className="fixed inset-0 z-20 flex bg-zebra-950/20">
      {/* A real `<dialog>`, open, so v2 popovers inside still find it to portal into. */}
      <dialog open {...aria} onKeyDown={onKeyDown} className={`relative m-auto overflow-visible border-0 bg-transparent p-0 outline-none motion-safe:animate-modal-in ${boxClass}`}>
        {children}
      </dialog>
    </div>,
    document.body,
  );
}

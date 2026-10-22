'use client';

import { useEffect, useMemo, useRef, type ReactNode } from 'react';

import { DialogLayer } from './dialog-layer';
import { DialogContext, EXPANDED, SIZES, type DialogSize } from './dialog-sizes';

export type { DialogSize } from './dialog-sizes';

/**
 * Design system v2 dialog (preview, shown on `/design-system/v2`): a
 * solid white card with the modal shadow over a lightly dimmed page.
 * Solid, not the glass `Panel`: a dialog already has the dimmed page to
 * set it apart, and a backdrop-filter stacked over the page's own glass
 * and cloud filter made Chrome flicker while the dialog scrolled.
 *
 * Built on the native `<dialog>` opened with `showModal()`, so the
 * browser does the hard parts: focus moves in and is trapped, the page
 * behind goes inert, Escape closes it, and focus returns to whatever
 * opened it. The backdrop is only faintly dimmed (no blur, for the same
 * reason), so a change the dialog makes to the page behind (a sidebar
 * row appearing) can still be seen happening.
 *
 * Closes on Escape and on a click outside the panel; both call
 * `onClose`, and the caller owns `open`. Mark the control to start on
 * with `data-autofocus` (a search box; skipped on touch screens so the
 * keyboard stays down); otherwise the first control is focused.
 *
 * Anatomy: build the inside from `dialog-parts` (`DialogHeader`,
 * `DialogBody`, `DialogFooter`), modelled on New client: no header or
 * footer bars, an icon circle and a quiet title at the top with Close at
 * the right, the primary action last at the bottom right. Form dialogs
 * have no Cancel; a confirmation has a `plain` Cancel before its action.
 *
 * Gotcha: the page outside a modal `<dialog>` is inert, so anything that
 * portals to `<body>` opens behind it and cannot be clicked. v2 `Dropdown`
 * portals into the nearest dialog for this reason; a new popover must too.
 *
 * @example
 * ```tsx
 * <Dialog open={open} onClose={() => setOpen(false)} aria-labelledby="blocks-title">
 *   <h2 id="blocks-title">Blocks</h2>
 * </Dialog>
 * <Dialog size="split" …>  // a short list beside its detail, fixed height
 * <Dialog size="split-tall" …>  // the same with a footer under it (Settings)
 * <Dialog size="short" …>  // a few settings, fixed height, smaller than md
 * <Dialog size="lg" …>  // a workspace: full screen on phones
 * <Dialog size="xl" …>  // a record: rail plus working column
 * <Dialog size="screen" …>  // an editor: the whole window, no edge to miss-click
 * ```
 *
 * @module components/ui-v2/dialog
 */

export interface DialogProps {
  open: boolean;
  /** Called on Escape and on a click outside the panel. */
  onClose: () => void;
  /** Id of the dialog's visible title. */
  'aria-labelledby': string;
  size?: DialogSize | undefined;
  /**
   * Grows a workspace dialog (`md` to `xl`) to nearly the whole window,
   * smoothly, while it stays open: for a moment that needs the room (a
   * video call on a client's profile). Turning it off eases it back.
   */
  expanded?: boolean | undefined;
  /**
   * `'dim'` (default) greys the page faintly. `'light'` washes it pale
   * instead, for a celebration: confetti and colour behind the card read
   * bright on a light page and went muddy on a grey one.
   */
  backdrop?: 'dim' | 'light' | undefined;
  /**
   * False keeps a click on the dimmed page from closing it, for an editor
   * where a stray click must never end the work (the document editor);
   * Escape and its own close button still do.
   */
  closeOnBackdrop?: boolean | undefined;
  /**
   * False draws it as a layer on the page instead of a modal
   * (`dialog-layer.tsx`), for content that portals its own floating parts
   * to `<body>` (production's proposal editor), which a modal would hide
   * under itself. Defaults to true.
   */
  modal?: boolean | undefined;
  children: ReactNode;
}

/** v2 dialog. See {@link DialogProps}. */
export function Dialog({ open, onClose, size = 'sm', expanded = false, backdrop = 'dim', closeOnBackdrop = true, modal = true, children, ...aria }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const context = useMemo(() => ({ size, onClose }), [size, onClose]);
  const box = expanded && size !== 'sm' && size !== 'form' && size !== 'screen' ? `h-dvh w-screen max-sm:max-h-none max-sm:max-w-none ${EXPANDED}` : SIZES[size];
  const panel = (
    <div className={`flex flex-col overflow-hidden rounded-panel bg-field text-zebra-950 shadow-xl ring-1 ring-hairline ${size === 'sm' || size === 'form' ? 'max-h-[inherit]' : size === 'screen' ? 'size-full rounded-none' : 'size-full max-sm:rounded-none'}`}>
      <DialogContext value={context}>{children}</DialogContext>
    </div>
  );
  useEffect(() => {
    if (!modal) return;
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // React never renders `autofocus`, so the native pick is always the
      // first control (often Close). `data-autofocus` names a better start,
      // but not on touch screens, where focusing a field opens the keyboard.
      if (window.matchMedia('(pointer: fine)').matches)
        dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open, modal]);
  if (!modal)
    return (
      <DialogLayer open={open} onClose={onClose} boxClass={box} {...aria}>
        {panel}
      </DialogLayer>
    );
  return (
    <dialog
      ref={ref}
      {...aria}
      // Escape: let the caller close it, so `open` stays the one truth.
      // Stopped here: a dialog opened from inside another (Preview over
      // the editor) sits in its React tree, and the cancel would otherwise
      // reach the outer dialog too and close both (live-found 2026-10-05).
      // Only its own cancel counts: a file input fires `cancel` when its
      // picker is dismissed, and that bubbled up and closed the dialog
      // around it (live-found 2026-10-08).
      onCancel={(e) => {
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      // The dialog element has no padding and the panel fills it, so a
      // click whose target is the dialog itself landed on the backdrop.
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
      // Both sizes resolve to lengths, so width and height ease between them;
      // auto margins keep it centred on every frame.
      // No ring on the dialog itself: focus can land on it (a key pressed on
      // its canvas), and its controls carry their own focus rings.
      className={`m-auto overflow-visible border-0 bg-transparent p-0 outline-none ${backdrop === 'light' ? 'backdrop:bg-field/60' : 'backdrop:bg-zebra-950/20'} open:motion-safe:animate-modal-in transition-[width,height] duration-300 ease-out motion-reduce:transition-none ${box}`}
    >
      {panel}
    </dialog>
  );
}

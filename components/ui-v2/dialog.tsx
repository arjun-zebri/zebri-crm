'use client';

import { useEffect, useRef, type ReactNode } from 'react';

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
 * <Dialog size="lg" …>  // a workspace: full screen on phones
 * <Dialog size="xl" …>  // a record: rail plus working column
 * ```
 *
 * @module components/ui-v2/dialog
 */

/**
 * `'sm'` is a 28rem card that grows with its content. `'md'` (40rem),
 * `'lg'` (56rem) and `'xl'` (72rem) are sheets of fixed height, so
 * filtering what is inside never makes them jump, and all fill the
 * screen on phones. Reach for `md` first: one column; `lg` for a rail
 * beside a list; `xl` for a record with a rail and a working column (a
 * client's profile). `'form'` is 40rem wide like `md` but grows with
 * its content like `sm`, for a short task over another dialog (sending
 * a reminder from an open invoice); a second `Dialog` opened while one is
 * open stacks in front of it, and Escape closes only the top one.
 */
export type DialogSize = 'sm' | 'form' | 'md' | 'split' | 'lg' | 'xl';

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
  children: ReactNode;
}

// The window less the same 2rem margin every workspace keeps from sm up.
const EXPANDED = 'sm:h-[calc(100dvh-4rem)] sm:w-[calc(100vw-4rem)]';

const SIZES: Record<DialogSize, string> = {
  sm: 'w-[min(28rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)]',
  form: 'w-[min(40rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)]',
  md:
    'h-dvh w-screen max-sm:max-h-none max-sm:max-w-none ' +
    'sm:h-[min(46rem,calc(100dvh-4rem))] sm:w-[min(40rem,calc(100vw-4rem))]',
  // As wide as lg but shorter, still a fixed height: a short list beside
  // its detail (the Payments AI insights), which lg's height left a third
  // empty. Full screen on phones, like the other workspaces.
  split:
    'h-dvh w-screen max-sm:max-h-none max-sm:max-w-none ' +
    'sm:h-[min(37rem,calc(100dvh-4rem))] sm:w-[min(56rem,calc(100vw-4rem))]',
  lg:
    'h-dvh w-screen max-sm:max-h-none max-sm:max-w-none ' +
    'sm:h-[min(46rem,calc(100dvh-4rem))] sm:w-[min(56rem,calc(100vw-4rem))]',
  xl:
    'h-dvh w-screen max-sm:max-h-none max-sm:max-w-none ' +
    'sm:h-[min(52rem,calc(100dvh-4rem))] sm:w-[min(72rem,calc(100vw-4rem))]',
};

/** v2 dialog. See {@link DialogProps}. */
export function Dialog({ open, onClose, size = 'sm', expanded = false, backdrop = 'dim', children, ...aria }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
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
  }, [open]);
  return (
    <dialog
      ref={ref}
      {...aria}
      // Escape: let the caller close it, so `open` stays the one truth.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // The dialog element has no padding and the panel fills it, so a
      // click whose target is the dialog itself landed on the backdrop.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      // Both sizes resolve to lengths, so width and height ease between them;
      // auto margins keep it centred on every frame.
      className={`m-auto overflow-visible border-0 bg-transparent p-0 ${backdrop === 'light' ? 'backdrop:bg-field/60' : 'backdrop:bg-zebra-950/20'} open:motion-safe:animate-modal-in transition-[width,height] duration-300 ease-out motion-reduce:transition-none ${expanded && size !== 'sm' && size !== 'form' ? `h-dvh w-screen max-sm:max-h-none max-sm:max-w-none ${EXPANDED}` : SIZES[size]}`}
    >
      <div className={`flex flex-col overflow-hidden rounded-panel bg-field text-zebra-950 shadow-xl ring-1 ring-zebra-950/5 ${size === 'sm' || size === 'form' ? 'max-h-[inherit]' : 'size-full max-sm:rounded-none'}`}>
        {children}
      </div>
    </dialog>
  );
}

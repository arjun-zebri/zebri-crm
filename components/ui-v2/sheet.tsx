'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Design system v2 sheet (preview): a panel that slides in from the
 * right edge of the surface it lives in (a dialog, a page region) over a
 * faint scrim, for a focused job that should not replace what is behind
 * it: reviewing and sending a drafted email from a client's profile.
 *
 * Unlike `Dialog` it does not portal or open a new top layer: place it
 * as the last child of a `relative` container and it covers that. Focus
 * moves in on open (to `data-autofocus`, else the sheet) and returns to
 * whatever opened it on close. Escape and a click on the scrim call
 * `onClose`; Escape is stopped here, so an enclosing `Dialog` stays open.
 * The caller owns `open`. Keep it mounted: it slides out rather than
 * vanishing, and is `inert` while shut.
 *
 * @example
 * ```tsx
 * <div className="relative">
 *   …
 *   <Sheet open={composing} onClose={() => setComposing(false)} aria-labelledby="compose-title">
 *     <h2 id="compose-title">Email to Amelia</h2>
 *   </Sheet>
 * </div>
 * ```
 *
 * @module components/ui-v2/sheet
 */

export interface SheetProps {
  open: boolean;
  /** Called on Escape and on a click on the scrim. */
  onClose: () => void;
  /** Id of the sheet's visible title. */
  'aria-labelledby': string;
  children: ReactNode;
}

/** v2 sheet. See {@link SheetProps}. */
export function Sheet({ open, onClose, children, ...aria }: SheetProps) {
  const ref = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const sheet = ref.current;
    if (!sheet) return;
    if (open) {
      opener.current = document.activeElement as HTMLElement | null;
      (sheet.querySelector<HTMLElement>('[data-autofocus]') ?? sheet).focus();
    } else if (opener.current) {
      opener.current.focus();
      opener.current = null;
    }
  }, [open]);
  return (
    <div inert={!open} className={`absolute inset-0 z-20 overflow-hidden ${open ? '' : 'pointer-events-none'}`}>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`absolute inset-0 bg-zebra-950/10 transition-opacity duration-200 motion-reduce:transition-none ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        {...aria}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return;
          // Stopped here, so the native dialog around it does not close too.
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        className={`absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-field shadow-xl outline-none transition-[translate] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {children}
      </section>
    </div>
  );
}

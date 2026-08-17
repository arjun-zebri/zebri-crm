'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';

import {
  getOpenOverlayDepth,
  getScrollLockCount,
  OVERLAY_Z,
  useBackdropDismiss,
  useOverlay,
  type OverlayLayer,
} from './use-overlay';

/**
 * How many overlays are open right now.
 *
 * @deprecated Prefer {@link getOpenOverlayDepth} from
 * `components/ui/use-overlay`. Re-exported here because the count now
 * spans every overlay surface, not just Modal, and callers that guard
 * their own Escape handler want the broader number anyway.
 */
export function getOpenModalDepth(): number {
  return getOpenOverlayDepth();
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Title slot. Accepts ReactNode so callers can render a mix of
   *  text + inline components (e.g. document number + state pill). */
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerActions?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'fullscreen';
  /** Stacking tier. `'nested'` for a modal opened from another modal;
   *  `'top'` for a surface that must clear everything, which is what
   *  ConfirmDialog uses. Defaults to `'base'`, or `'nested'` when the
   *  legacy `nested` prop is set. */
  layer?: OverlayLayer;
  /** @deprecated Pass `layer="nested"` instead. Kept so existing call
   *  sites keep working unchanged. */
  nested?: boolean;
  /** Drop the body's default bottom padding so children can bleed
   *  to the modal's rounded bottom edge. Used by full-bleed tables
   *  (e.g. plan-comparison) so column tints reach the bottom. */
  flushBottom?: boolean;
  /** Skip the header band entirely and float the close button in the
   *  top-right corner, so the body's own content starts at the very top.
   *  Used by the welcome tour, whose per-step title should sit flush at
   *  the top rather than below a tall, otherwise-empty header row. */
  floatingClose?: boolean;
}

const SIZE_CLASS: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
  // `2xl` is for medium-wide tables (~960px max) — not yet used.
  '2xl': 'max-w-5xl',
  // `fullscreen` matches the couple-profile overlay dimensions
  // (90vw / max 1400px / 90vh) so the two top-level overlays feel
  // like the same surface. Below the sm breakpoint it stretches
  // to the viewport edges (p-2 on the wrapper).
  fullscreen: 'sm:w-[90vw] sm:max-w-[1400px]',
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  headerActions,
  size = 'md',
  layer,
  nested = false,
  flushBottom = false,
  floatingClose = false,
}: ModalProps) {
  // Auto-tier: a base backdrop (z-50) opened from inside a fullscreen
  // overlay (couple/contact profile, settings — panels at z-[60]) is
  // swallowed behind the panel, so the modal appears with no dark
  // backdrop. Any surface covering the page holds the shared scroll
  // lock, so a non-zero count at the moment of opening means "stack
  // above". Latched via render-phase state adjustment on each
  // open/close transition — computed before this modal's own lock
  // registers (its effects haven't run yet), and frozen afterwards so
  // later re-renders (which would count ourselves) can't flip the tier
  // mid-life.
  const [latched, setLatched] = useState<{ open: boolean; tier: OverlayLayer }>({
    open: false,
    tier: 'base',
  });
  if (isOpen !== latched.open) {
    setLatched({ open: isOpen, tier: isOpen && getScrollLockCount() > 0 ? 'nested' : 'base' });
  }

  // `nested` predates `layer`; honour both when given — the auto tier
  // only decides for call sites that never said.
  const z = OVERLAY_Z[layer ?? (nested ? 'nested' : latched.tier)];

  useOverlay({ isOpen, onClose });
  const backdropHandlers = useBackdropDismiss(onClose);

  // Portal to the body. The panel is `position: fixed`, which resolves
  // against the nearest transformed ancestor rather than the viewport —
  // so a modal opened from inside a React Flow node (every node carries
  // a `transform`) rendered at the node's own size and position, with a
  // backdrop covering only part of the screen.
  //
  // Guarded on `document` rather than a mounted-state effect: effects
  // run child-first, so an effect-gated portal let a nested
  // ConfirmDialog attach to the body *before* the Modal containing it,
  // inverting overlay order in the DOM. Portalling during render keeps
  // parent-before-child.
  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* `h-screen` looks redundant alongside `inset-0` but is load-
          bearing on mobile: iOS Safari's dynamic browser chrome
          can leave `fixed inset-0` short of the visual viewport.
          Forcing `100vh` guarantees full-screen backdrop coverage
          (notably the bottom edge of the compare-plans modal —
          regression caught during Phase 2B UI verification). */}
      <div
        className={`fixed inset-0 h-screen bg-black/40 animate-fade-in ${z.backdrop}`}
        {...backdropHandlers}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`fixed inset-0 flex items-center justify-center p-4 ${z.panel}`}
        {...backdropHandlers}
      >
        <div
          className={`bg-surface rounded-control border border-border w-full flex flex-col overflow-hidden animate-modal-in ${SIZE_CLASS[size]} ${
            // Fullscreen modals lock to 90vh so the size doesn't
            // shrink while content is loading. Matches the couple-
            // profile overlay's vertical sizing. Other sizes keep
            // their max-h behaviour so short modals stay compact.
            size === 'fullscreen' ? 'h-full sm:h-[90vh]' : 'max-h-[85vh]'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {floatingClose ? (
            // Headerless: the close button floats over the top-right so the
            // body's first row (e.g. the wizard's step title) sits flush at
            // the very top instead of below an otherwise-empty header band.
            <button
              onClick={onClose}
              className="absolute top-3 right-3 z-10 p-1.5 text-text-subtle hover:text-gray-600 transition cursor-pointer"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          ) : (
            /* Header — height ≈ 4rem (py-4 + text-section content). The
               `flushBottom` body below subtracts that from 85vh to
               cap its scroll height. If you change the header
               padding or content size, update the calc() in the
               body's maxHeight to match. */
            <div
              className={`flex items-center justify-between px-4 sm:px-6 py-4 ${title ? 'border-b border-border' : ''}`}
            >
              {title && (
                // A real heading: screen readers announce the dialog name
                // and e2e selectors can target `h2:has-text(...)`.
                <h2 className="flex items-center gap-2 text-section font-semibold text-text">
                  {title}
                </h2>
              )}
              <div className={`flex items-center gap-1 ${!title ? 'ml-auto' : ''}`}>
                {headerActions && (
                  <>
                    {headerActions}
                    <div className="w-px h-4 bg-gray-200 mx-1" />
                  </>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 text-text-subtle hover:text-gray-600 transition cursor-pointer"
                >
                  <X size={18} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          )}

          <div
            className={`overflow-y-auto px-4 sm:px-6 pt-4 ${flushBottom ? 'pb-0' : 'flex-1 pb-4'}`}
            // flushBottom: drop flex-1 so body sizes tightly to its
            // content (no expansion = no white gap at the bottom).
            // Cap with calc(85vh - header) so content can still scroll
            // internally when it would exceed the modal's max-h.
            style={flushBottom ? { maxHeight: 'calc(85vh - 4rem)' } : undefined}
          >
            {children}
          </div>

          {footer && (
            <div className="border-t border-border px-6 py-4 bg-gray-50 rounded-b-control">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}

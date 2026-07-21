'use client';

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

// Tracks how many Modal instances are currently open so only the topmost
// one responds to Escape - prevents nested modals from closing their parent.
let _openModalDepth = 0;

/** Returns the number of Modal instances currently open. Use this in custom
 *  overlays that manage their own Escape handler to skip closing when a nested
 *  Modal is on top. */
export function getOpenModalDepth() {
  return _openModalDepth;
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
  nested?: boolean;
  /** Drop the body's default bottom padding so children can bleed
   *  to the modal's rounded bottom edge. Used by full-bleed tables
   *  (e.g. plan-comparison) so column tints reach the bottom. */
  flushBottom?: boolean;
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
  nested = false,
  flushBottom = false,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    _openModalDepth++;
    const myDepth = _openModalDepth;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && _openModalDepth === myDepth) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      _openModalDepth--;
      if (_openModalDepth === 0) document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Only close on a backdrop click whose press ALSO started on the
  // backdrop. Without this, dragging to select text inside an input and
  // releasing outside it makes the browser fire `click` on the nearest
  // common ancestor (this wrapper), which would otherwise close the modal.
  const pressedOnBackdrop = useRef(false);
  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    pressedOnBackdrop.current = e.target === e.currentTarget;
  };
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && pressedOnBackdrop.current) onClose();
    pressedOnBackdrop.current = false;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* `h-screen` looks redundant alongside `inset-0` but is load-
          bearing on mobile: iOS Safari's dynamic browser chrome
          can leave `fixed inset-0` short of the visual viewport.
          Forcing `100vh` guarantees full-screen backdrop coverage
          (notably the bottom edge of the compare-plans modal —
          regression caught during Phase 2B UI verification). */}
      <div
        className={`fixed inset-0 h-screen bg-black/40 animate-fade-in ${nested ? 'z-[75]' : 'z-50'}`}
        onMouseDown={handleBackdropMouseDown}
        onClick={handleBackdropClick}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`fixed inset-0 flex items-center justify-center p-4 ${nested ? 'z-[80]' : 'z-[60]'}`}
        onMouseDown={handleBackdropMouseDown}
        onClick={handleBackdropClick}
      >
        <div
          className={`bg-white rounded-2xl border border-border w-full flex flex-col overflow-hidden animate-modal-in ${SIZE_CLASS[size]} ${
            // Fullscreen modals lock to 90vh so the size doesn't
            // shrink while content is loading. Matches the couple-
            // profile overlay's vertical sizing. Other sizes keep
            // their max-h behaviour so short modals stay compact.
            size === 'fullscreen' ? 'h-full sm:h-[90vh]' : 'max-h-[85vh]'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header — height ≈ 4rem (py-4 + text-xl content). The
              `flushBottom` body below subtracts that from 85vh to
              cap its scroll height. If you change the header
              padding or content size, update the calc() in the
              body's maxHeight to match. */}
          <div
            className={`flex items-center justify-between px-4 sm:px-6 py-4 ${title ? 'border-b border-gray-200' : ''}`}
          >
            {title && (
              // A real heading: screen readers announce the dialog name
              // and e2e selectors can target `h2:has-text(...)`.
              <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
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
                className="p-1.5 text-gray-400 hover:text-gray-600 transition cursor-pointer"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>

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
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-2xl">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

'use client'

import { X } from 'lucide-react'

import { OVERLAY_Z, useOverlay } from './use-overlay'

interface SidePanelProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  headerActions?: React.ReactNode
}

export function SidePanel({
  isOpen,
  onClose,
  title,
  children,
  footer,
  headerActions,
}: SidePanelProps) {
  // Was a bare `if (e.key === 'Escape')` handler with no depth check, so
  // a dialog opened from inside the panel closed both at once.
  useOverlay({ isOpen, onClose })

  if (!isOpen) return null

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in ${OVERLAY_Z.base.backdrop}`}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`fixed top-0 right-0 bottom-0 ${OVERLAY_Z.base.panel} w-full sm:w-[640px] lg:w-[760px] bg-surface shadow-2xl flex flex-col animate-slide-in-right`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-border">
          {title && (
            <h2 className="flex-1 text-sm font-medium text-text-muted truncate">{title}</h2>
          )}
          <div className="flex items-center gap-1 ml-auto">
            {headerActions}
            <button
              onClick={onClose}
              className="p-1.5 text-text-subtle hover:text-gray-700 hover:bg-surface-emphasis rounded-control transition cursor-pointer"
              aria-label="Close"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4">{children}</div>

        {footer && (
          <div className="border-t border-border px-4 sm:px-5 py-3 bg-gray-50">{footer}</div>
        )}
      </div>
    </>
  )
}

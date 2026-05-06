'use client'

import { useEffect } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface SidePanelProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  headerActions?: React.ReactNode
  onPrev?: () => void
  onNext?: () => void
}

export function SidePanel({
  isOpen,
  onClose,
  title,
  children,
  footer,
  headerActions,
  onPrev,
  onNext,
}: SidePanelProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in z-50"
        onClick={onClose}
      />
      <div
        className="fixed top-0 right-0 bottom-0 z-[60] w-full sm:w-[640px] lg:w-[760px] bg-white shadow-2xl flex flex-col animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-gray-200">
          <div className="hidden sm:flex items-center gap-1">
            {onPrev && (
              <button
                onClick={onPrev}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                title="Previous"
                aria-label="Previous task"
              >
                <ChevronLeft size={16} strokeWidth={1.5} />
              </button>
            )}
            {onNext && (
              <button
                onClick={onNext}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                title="Next"
                aria-label="Next task"
              >
                <ChevronRight size={16} strokeWidth={1.5} />
              </button>
            )}
          </div>
          {title && (
            <h2 className="flex-1 text-sm font-medium text-gray-500 truncate">{title}</h2>
          )}
          <div className="flex items-center gap-1 ml-auto">
            {headerActions}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition cursor-pointer"
              aria-label="Close"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4">{children}</div>

        {footer && (
          <div className="border-t border-gray-200 px-4 sm:px-5 py-3 bg-gray-50">{footer}</div>
        )}
      </div>
    </>
  )
}

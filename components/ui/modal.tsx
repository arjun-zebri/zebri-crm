'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  headerActions?: React.ReactNode
  size?: 'sm' | 'md'
  nested?: boolean
}

export function Modal({ isOpen, onClose, title, children, footer, headerActions, size = 'md', nested = false }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
      return () => {
        document.removeEventListener('keydown', handleEscape)
        document.body.style.overflow = 'unset'
      }
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in ${nested ? 'z-[75]' : 'z-50'}`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-0 flex items-center justify-center p-4 ${nested ? 'z-[80]' : 'z-[60]'}`}
        onClick={onClose}
      >
        <div
          className={`bg-white rounded-2xl shadow-xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-modal-in ${size === 'sm' ? 'max-w-sm' : 'max-w-lg'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`flex items-center justify-between px-4 sm:px-6 py-4 ${title ? 'border-b border-gray-200' : ''}`}>
            {title && <h2 className="text-xl font-semibold text-gray-900">{title}</h2>}
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

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
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
  )
}

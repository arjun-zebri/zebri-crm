'use client'

import { CheckCircle, XCircle } from 'lucide-react'
import { createContext, useContext, useState, useCallback } from 'react'

type ToastType = 'success' | 'error'

interface ToastAction {
  /** Label for the action button. */
  label: string
  /** Callback when the action button is clicked. */
  onClick: () => void
}

interface ToastItem {
  id: string
  message: string
  type: ToastType
  action?: ToastAction
}

interface ToastContextValue {
  /**
   * Display a toast notification.
   * @param message - The message to display
   * @param type - Toast type: 'success' (default) or 'error'
   * @param action - Optional action button with label and onClick handler
   */
  toast: (message: string, type?: ToastType, action?: ToastAction) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success', action?: ToastAction) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, message, type, action }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2.5 bg-surface border border-border rounded-control px-4 py-3 shadow-lg text-sm animate-slide-in-right pointer-events-auto"
          >
            {t.type === 'success' ? (
              <CheckCircle size={15} strokeWidth={1.5} className="text-emerald-500 flex-shrink-0" />
            ) : (
              <XCircle size={15} strokeWidth={1.5} className="text-red-500 flex-shrink-0" />
            )}
            <span className="text-gray-800">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={t.action.onClick}
                className="ml-auto pl-2 text-xs font-medium text-text-muted hover:text-text cursor-pointer rounded-control hover:bg-surface-muted px-2 py-1 transition"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

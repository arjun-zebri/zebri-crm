'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'

type ToastType = 'success' | 'error'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, message, type }])
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
            className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-lg text-sm animate-slide-in-right pointer-events-auto"
          >
            {t.type === 'success' ? (
              <CheckCircle size={15} strokeWidth={1.5} className="text-emerald-500 flex-shrink-0" />
            ) : (
              <XCircle size={15} strokeWidth={1.5} className="text-red-500 flex-shrink-0" />
            )}
            <span className="text-gray-800">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

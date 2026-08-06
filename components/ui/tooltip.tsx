'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  label: string
  shortcut?: string
  side?: 'top' | 'bottom'
  /** Extra classes for the trigger wrapper, e.g. `flex-1` so a wrapped button
   *  keeps its width in a flex row. */
  className?: string
  children: ReactNode
}

export function Tooltip({ label, shortcut, side = 'bottom', className = '', children }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open || !triggerRef.current) {
      if (position !== null) setPosition(null)
      return
    }
    const update = () => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      setPosition({
        top: side === 'bottom' ? rect.bottom + 6 : rect.top - 6,
        left: rect.left + rect.width / 2,
      })
    }
    update()
    // Keep the tooltip glued to the trigger when the page scrolls or resizes
    // while it's open — otherwise it drifts off the icon as content shifts.
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  // position deliberately omitted: it's set inside update(), would re-create listeners every frame.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, side])

  return (
    <>
      <span
        ref={triggerRef}
        className={`relative inline-flex ${className}`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </span>
      {open && position && typeof document !== 'undefined' && createPortal(
        <span
          role="tooltip"
          className={`pointer-events-none fixed z-[80] px-2 py-1 rounded-control bg-gray-900 text-white text-[11px] font-medium whitespace-nowrap shadow-lg ${
            side === 'top' ? '-translate-x-1/2 -translate-y-full' : '-translate-x-1/2'
          }`}
          style={{ top: position.top, left: position.left }}
        >
          {label}
          {shortcut && <span className="ml-1.5 text-gray-400 font-mono">{shortcut}</span>}
        </span>,
        document.body,
      )}
    </>
  )
}

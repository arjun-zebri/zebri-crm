'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Max width of a wrapping tooltip, in px. Mirrors MULTILINE_CLASSES below. */
const MULTILINE_WIDTH = 280

interface TooltipProps {
  label: string
  shortcut?: string
  side?: 'top' | 'bottom'
  /**
   * Let the label wrap instead of running on one line, preserving any
   * newlines so an explanation and its example stay separate. Use for a
   * sentence or a worked example; the default single-line form is for short
   * hints and would otherwise run off the screen.
   */
  multiline?: boolean
  /** Extra classes for the trigger wrapper, e.g. `flex-1` so a wrapped button
   *  keeps its width in a flex row. */
  className?: string
  children: ReactNode
}

export function Tooltip({ label, shortcut, side = 'bottom', multiline = false, className = '', children }: TooltipProps) {
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
      const centre = rect.left + rect.width / 2
      // The tooltip is centred on the trigger, so half its width must fit on
      // each side. Without this a wide label next to a left-hand control is
      // simply clipped by the viewport edge.
      const half = (multiline ? MULTILINE_WIDTH : 0) / 2
      const margin = 8
      setPosition({
        top: side === 'bottom' ? rect.bottom + 6 : rect.top - 6,
        left: half
          ? Math.min(Math.max(centre, half + margin), window.innerWidth - half - margin)
          : centre,
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
  }, [open, side, multiline])

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
          className={`pointer-events-none fixed z-[140] px-2 py-1 rounded-control bg-gray-900 text-white text-body font-medium shadow-lg ${
            multiline ? 'whitespace-pre-line text-left' : 'whitespace-nowrap'
          } ${side === 'top' ? '-translate-x-1/2 -translate-y-full' : '-translate-x-1/2'}`}
          style={{
            top: position.top,
            left: position.left,
            ...(multiline ? { maxWidth: MULTILINE_WIDTH } : {}),
          }}
        >
          {label}
          {shortcut && <span className="ml-1.5 text-text-subtle font-mono">{shortcut}</span>}
        </span>,
        document.body,
      )}
    </>
  )
}

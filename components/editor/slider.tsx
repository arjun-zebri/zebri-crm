'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A pointer- and keyboard-drivable slider (drag, arrow keys, Page Up/Down,
 * Home/End). Shared by the Branding editor and the proposal section editor
 * (Proposal Layout v2 Phase 2, spec 5.3).
 *
 * @module components/editor/slider
 */

interface SliderProps {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  /**
   * Fires once a drag ends (pointer up) or a keyboard nudge completes, with
   * the settled value, for a caller that dispatches transient changes
   * while dragging and a single committed change on release (e.g. an
   * undo-history boundary). Takes the value itself, rather than the
   * caller re-reading its own last-known value, because a controlled
   * `value` prop can still be one render behind the drag: multiple
   * `pointermove`s can fire before React commits the state update from
   * the first one's `onChange`, and a keyboard nudge calls `onChange` and
   * this callback back to back in the same synchronous handler, before
   * any re-render happens at all. Omit when every `onChange` call is
   * already a discrete, committed step.
   */
  onCommit?: (v: number) => void
  ariaLabel?: string
  className?: string
}

const FILL = '#111827'
const KNOB_BORDER = '#111827'

/** A draggable, keyboard-accessible slider over `[min, max]`. */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  onCommit,
  ariaLabel,
  className = '',
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  // The last value handed to `onChange`, read by `onCommit` instead of the
  // `value` prop: see the `onCommit` doc above for why the prop can lag.
  const lastValueRef = useRef(value)

  const clamp = useCallback(
    (v: number) => Math.min(max, Math.max(min, v)),
    [min, max]
  )

  const snap = useCallback(
    (v: number) => {
      const n = Math.round((v - min) / step) * step + min
      return Math.round(n / step) * step
    },
    [min, step]
  )

  const setFromClient = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      const ratio = (clientX - rect.left) / rect.width
      const raw = min + ratio * (max - min)
      const next = clamp(snap(raw))
      // Round-trip to avoid 1e-15 drift
      const decimals = step < 1 ? Math.max(0, -Math.floor(Math.log10(step))) : 0
      const rounded = parseFloat(next.toFixed(decimals))
      lastValueRef.current = rounded
      onChange(rounded)
    },
    [min, max, step, clamp, snap, onChange]
  )

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => setFromClient(e.clientX)
    const onUp = () => {
      setDragging(false)
      onCommit?.(lastValueRef.current)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragging, setFromClient, onCommit])

  const ratio = ((value - min) / (max - min)) * 100

  const onKeyDown = (e: React.KeyboardEvent) => {
    let next = value
    const big = (max - min) / 10
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = clamp(value - step)
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = clamp(value + step)
    else if (e.key === 'PageDown') next = clamp(value - big)
    else if (e.key === 'PageUp') next = clamp(value + big)
    else if (e.key === 'Home') next = min
    else if (e.key === 'End') next = max
    else return
    e.preventDefault()
    const decimals = step < 1 ? Math.max(0, -Math.floor(Math.log10(step))) : 0
    const rounded = parseFloat(next.toFixed(decimals))
    lastValueRef.current = rounded
    onChange(rounded)
    // A keyboard nudge has no separate "release" moment the way a drag
    // does: the keystroke is already the whole, discrete step, so it
    // commits immediately rather than waiting for a pointerup that will
    // never come.
    onCommit?.(rounded)
  }

  return (
    <div
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        e.preventDefault()
        setDragging(true)
        setFromClient(e.clientX)
        ;(e.currentTarget as HTMLElement).focus()
      }}
      className={`relative h-5 flex items-center cursor-pointer select-none focus:outline-none ${className}`}
    >
      <div
        ref={trackRef}
        className="relative w-full h-1.5 rounded-pill bg-surface-emphasis"
      >
        <div
          className={`absolute top-0 left-0 h-full rounded-pill ${dragging ? '' : 'transition-[width] duration-100'}`}
          style={{ width: `${ratio}%`, background: FILL }}
        />
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-pill bg-surface border-2 shadow-sm ${
            dragging ? 'scale-110' : 'transition-[left,transform,box-shadow] duration-100'
          }`}
          style={{
            left: `${ratio}%`,
            borderColor: KNOB_BORDER,
            boxShadow: dragging
              ? '0 0 0 4px rgba(17,24,39,0.12)'
              : '0 1px 2px rgba(0,0,0,0.05)',
          }}
        />
      </div>
    </div>
  )
}

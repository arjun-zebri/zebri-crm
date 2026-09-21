'use client'

import { useEffect, useRef, useState } from 'react'

import { applySnaps, clamp, dragValue, zoomFactor, type Snap } from './resize-math'

/**
 * The one resize handle every Phase 2 editor drags (section height and
 * width, image, columns, spacer) and the Branding hero's height grip,
 * rebuilt on top of it.
 *
 * @module components/editor/resize-grip
 */

/** Props for {@link ResizeGrip}. */
export interface ResizeGripProps {
  /** `'y'` sits on the bottom edge and drags vertically; `'x'` sits on the side edge and drags horizontally. */
  axis: 'x' | 'y'
  value: number
  min: number
  max: number
  /** Layout px per unit of `value` (1 for px values, e.g. viewportHeight/100 for vh). */
  scale?: number
  step?: number
  snaps?: readonly Snap[]
  tolerance?: number
  /** Negates the drag delta before it reaches `dragValue`, for a handle whose visual drag direction is reversed from the value's growth direction (a left/start edge, where dragging left grows the value). Keyboard nudging (`onKeyDown` below) is unaffected: the arrow keys already say which direction is "increase". */
  invert?: boolean
  /** Readout text while dragging, e.g. (v) => `${v}px` or a snap label. */
  format: (value: number) => string
  onChange: (value: number) => void
  /** Fired once on mouse up with the final value (history commit point). */
  onCommit?: (value: number) => void
  ariaLabel: string
  className?: string
  /**
   * `'bar'` (default) draws the edge bar and sizes the hit box to that
   * edge; `'dot'` draws a small round corner handle in a 16px hit box
   * with no edge placement of its own, so the caller positions it on the
   * corner it wants (and sets the diagonal cursor) via `className`.
   */
  shape?: 'bar' | 'dot'
}

/**
 * A draggable, keyboard-accessible resize handle. On `mousedown` it
 * measures the zoom of its offset parent once (so a CSS-`zoom`-scaled
 * canvas still drags 1:1 in layout units) and the drag start value, then
 * on window `mousemove` runs `dragValue` and calls `onChange` whenever
 * the resolved value changes, showing a floating readout next to the
 * grip (the matching snap's label when the drag has locked onto one,
 * otherwise `format(value)`). `onCommit` fires once on `mouseup` with the
 * final value, the point to push onto undo history. Arrow keys nudge by
 * `step` (default 1) for anyone who can't drag: `ArrowDown` / `ArrowRight`
 * increase, `ArrowUp` / `ArrowLeft` decrease. The root element carries
 * `data-dragging="true"` for the duration of a drag, so a caller that
 * wants to style around the drag (a `className` styled with
 * `data-[dragging=true]:...`) can, without the drag state itself being a
 * prop; the Branding hero's grip uses this to stay visible for the whole
 * drag even after the pointer leaves its hover-reveal area. `invert`
 * flips which screen direction grows the value, for a handle on the
 * value's "start" side (a left edge, a top-left corner).
 */
export function ResizeGrip({
  axis,
  value,
  min,
  max,
  scale = 1,
  step,
  snaps,
  tolerance = 0,
  invert = false,
  format,
  onChange,
  onCommit,
  ariaLabel,
  className = '',
  shape = 'bar',
}: ResizeGripProps) {
  const [dragging, setDragging] = useState<number | null>(null)
  // Holds the current drag's listener-removal function, if a drag is in
  // progress, so the unmount effect below can tear it down even when
  // mouseup never fires on this element (block deleted mid-drag, tab
  // switched away while dragging).
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => cleanupRef.current?.()
  }, [])

  const startDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    // Stop the drag from also selecting or dragging whatever the grip
    // sits on top of.
    e.preventDefault()
    e.stopPropagation()
    const zoom = zoomFactor(e.currentTarget.offsetParent as HTMLElement | null)
    const startClient = axis === 'y' ? e.clientY : e.clientX
    const startValue = value
    let last = startValue
    setDragging(startValue)
    const onMove = (ev: MouseEvent) => {
      const client = axis === 'y' ? ev.clientY : ev.clientX
      const rawDelta = client - startClient
      const next = dragValue({
        start: startValue,
        deltaScreenPx: invert ? -rawDelta : rawDelta,
        zoom,
        scale,
        min,
        max,
        // `step`/`snaps` are spread in only when set: with
        // `exactOptionalPropertyTypes`, passing `step: undefined`
        // explicitly is a different (disallowed) thing from omitting it.
        ...(step !== undefined ? { step } : {}),
        ...(snaps !== undefined ? { snaps } : {}),
        tolerance,
      })
      if (next === last) return
      last = next
      setDragging(next)
      onChange(next)
    }
    const removeListeners = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    const onUp = () => {
      setDragging(null)
      onCommit?.(last)
      removeListeners()
      cleanupRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    cleanupRef.current = removeListeners
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const delta = step ?? 1
    const increaseKey = axis === 'y' ? 'ArrowDown' : 'ArrowRight'
    const decreaseKey = axis === 'y' ? 'ArrowUp' : 'ArrowLeft'
    let next: number
    if (e.key === increaseKey) next = value + delta
    else if (e.key === decreaseKey) next = value - delta
    else return
    e.preventDefault()
    next = clamp(next, min, max)
    if (snaps) next = applySnaps(next, snaps, tolerance)
    onChange(next)
  }

  const shown = dragging ?? value
  const snapLabel = snaps?.find((s) => s.value === shown)?.label
  const isY = axis === 'y'

  return (
    <div
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      title="Drag to resize"
      data-dragging={dragging !== null ? 'true' : undefined}
      onMouseDown={startDrag}
      onKeyDown={onKeyDown}
      className={`absolute z-10 flex items-center justify-center outline-none ${
        shape === 'dot'
          ? 'h-4 w-4'
          : isY ? 'inset-x-0 bottom-0 h-3 cursor-ns-resize' : 'inset-y-0 right-0 w-3 cursor-ew-resize'
      } ${className}`}
    >
      {dragging !== null && (
        <span
          className={`absolute rounded-pill bg-brand-fg px-2 py-0.5 text-body tabular-nums text-text-inverse pointer-events-none ${
            isY ? 'bottom-4' : 'right-4'
          }`}
        >
          {snapLabel ?? format(shown)}
        </span>
      )}
      {shape === 'dot' ? (
        <div className="h-2.5 w-2.5 rounded-pill border-2 border-brand-fg bg-surface shadow-sm" />
      ) : (
        <div className={`rounded-pill bg-brand-fg shadow-sm ${isY ? 'h-1 w-10' : 'h-10 w-1'}`} />
      )}
    </div>
  )
}

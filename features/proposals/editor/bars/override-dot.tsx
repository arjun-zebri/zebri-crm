'use client'

/**
 * The small dot a bar control shows when its current value differs from
 * the section's starting style (`newSectionFor(kind).style`), so an MC
 * scanning a restyled section can see at a glance which controls they
 * touched. Purely presentational: callers decide "active" by comparing
 * their own control's value against the baseline.
 *
 * Also exports {@link ControlDot}, the positioned wrapper most dot-bearing
 * controls use to pin the dot to their corner and carry a stable test
 * hook, so each control site is one line instead of repeating the same
 * `relative` span everywhere.
 *
 * @module features/proposals/editor/bars/override-dot
 */
import type { ReactNode } from 'react'

/** Props for {@link OverrideDot}. */
export interface OverrideDotProps {
  /** Whether the owning control's value differs from the section's starting style. */
  active: boolean
}

/**
 * A 6px dot pinned to a control's top-right corner. Renders nothing when
 * `active` is false, so callers can render it unconditionally next to
 * every dot-bearing control without an extra guard at each call site.
 */
export function OverrideDot({ active }: OverrideDotProps) {
  if (!active) return null
  return (
    <span
      aria-hidden
      data-testid="override-dot"
      className="pointer-events-none absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-pill bg-brand-fg"
    />
  )
}

/** Props for {@link ControlDot}. */
export interface ControlDotProps {
  /** Stable `data-testid` for the wrapper, so a test can scope its `OverrideDot` query to one control. */
  testId: string
  /** Whether this control's value differs from the section's starting style. */
  active: boolean
  children: ReactNode
}

/** A control wrapped in a positioned container carrying its own {@link OverrideDot} and a stable test hook. */
export function ControlDot({ testId, active, children }: ControlDotProps) {
  return (
    <span data-testid={testId} className="relative inline-flex shrink-0 items-center">
      {children}
      <OverrideDot active={active} />
    </span>
  )
}

'use client'

/**
 * The one 32px toolbar row shared by every control bar in the proposal
 * editor (section, text, node). Lays the primary controls out left to
 * right and keeps a trailing `overflow` slot (the bar's own "..." menu)
 * pinned at the end behind a divider, so no bar file hand-rolls its own
 * row chrome.
 *
 * Why this does not measure itself with a `ResizeObserver`: the spec's
 * 380px overflow threshold only ever needs to move a handful of
 * low-frequency controls out of the row (for the section bar: Hide on
 * phone, Duplicate, Reset style, Delete), and those already live behind
 * the `overflow` slot's own trigger by construction (see
 * `section-bar.tsx`) rather than by a runtime width check. A dynamic
 * collapse of the remaining controls would add a `ResizeObserver` and a
 * measured-width state purely to guard a case the bar's own control
 * order already handles: the collapse threshold is the bar's layout
 * itself, applied by the canvas width the host keeps above 380px, not by
 * this shell.
 *
 * @module features/proposals/editor/bars/bar-shell
 */
import type { ReactNode } from 'react'

import { ToolbarDivider } from '@/components/editor'

/** Props for {@link BarShell}. */
export interface BarShellProps {
  /** The row's primary controls, left to right. */
  children: ReactNode
  /** The trailing "..." menu trigger and panel, always rendered last, past a divider. */
  overflow?: ReactNode
}

/** The bar's one 32px row: primary controls, then the `overflow` slot. */
export function BarShell({ children, overflow }: BarShellProps) {
  return (
    <div className="flex h-8 items-center gap-1">
      {children}
      {overflow ? (
        <>
          <ToolbarDivider />
          {overflow}
        </>
      ) : null}
    </div>
  )
}

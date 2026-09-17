'use client'

/**
 * The text bar's plain icon toggle button: Italic, Underline and
 * Strike. `PillToggle` doesn't fit these: each is independently on or
 * off, not one-of-a-set the way Weight (Regular/Bold) or Align (left/
 * center/right) are. (The list toggles are independently on/off too,
 * but live as `MenuItem`s in the `...` overflow menu instead, see
 * `text-bar-overflow.tsx`.)
 *
 * @module features/proposals/editor/bars/text-bar-toggle-button
 */
import type { ReactNode } from 'react'

import { Tooltip } from '@/components/ui/tooltip'

import { toggleButtonClass } from './text-bar-style'

/** Props for {@link TextBarToggleButton}. */
export interface TextBarToggleButtonProps {
  /** Accessible name and tooltip text; the icon carries no text of its own. */
  label: string
  active: boolean
  onClick: () => void
  children: ReactNode
}

/** One icon-only toggle: lit when `active`, with a tooltip naming it. */
export function TextBarToggleButton({ label, active, onClick, children }: TextBarToggleButtonProps) {
  return (
    <Tooltip label={label}>
      <button type="button" aria-label={label} aria-pressed={active} onClick={onClick} className={toggleButtonClass(active)}>
        {children}
      </button>
    </Tooltip>
  )
}

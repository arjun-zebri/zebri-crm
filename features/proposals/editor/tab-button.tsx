'use client'

/**
 * One `role="tab"` button in a two-tab strip, used by
 * `global-style/global-style-popover.tsx`'s Page/Text strip. Kept as its
 * own primitive so any other tab strip in the editor shares the exact
 * same look instead of a hand-copied version drifting from it.
 *
 * @module features/proposals/editor/tab-button
 */
import type { ReactNode } from 'react'

/** Props for {@link TabButton}. */
export interface TabButtonProps {
  active: boolean
  onClick: () => void
  children: ReactNode
}

/** One tab button in a `role="tablist"` strip. */
export function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-control px-2.5 py-1 text-body transition-colors ${
        active ? 'bg-surface-emphasis font-medium text-text' : 'text-text-muted hover:text-text'
      }`}
    >
      {children}
    </button>
  )
}

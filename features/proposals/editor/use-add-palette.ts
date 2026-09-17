'use client'

/**
 * Palette-open state for the section canvas's add line
 * (`add-line.tsx`/`add-palette.tsx`, Task 8): which index a new section
 * lands at, and the element to anchor the palette to (a hover "+" line)
 * versus none (the trailing button, which opens a full `Modal` instead).
 * Extracted out of `section-canvas.tsx` to keep that file near the
 * ~150-line guideline.
 *
 * @module features/proposals/editor/use-add-palette
 */
import { useCallback, useState } from 'react'

import type { Section } from '../model/layout'

import type { LayoutAction } from './state'

/** What {@link useAddPalette} returns. */
export interface UseAddPaletteReturn {
  open: boolean
  /** Layout index the palette will insert at; `null` while closed. */
  at: number | null
  /** The add line's own element, when opened from a hover "+" line; `null` for the trailing button. */
  anchor: HTMLElement | null
  /** Opens the palette at `index`, anchored to `anchorEl` when the caller passed one. */
  requestAdd: (index: number, anchorEl?: HTMLElement) => void
  onOpenChange: (open: boolean) => void
  /** Inserts `section` at the pending index and closes the palette. */
  onAdd: (section: Section, at: number) => void
}

/**
 * Palette-open state plus the `addSection` dispatch wiring
 * `SectionCanvas` mounts `AddPalette` with. `dispatch`'s identity is
 * assumed stable across renders (as `useLayoutEditor`'s is), so this
 * hook's own callbacks can safely depend on it.
 */
export function useAddPalette(dispatch: (action: LayoutAction, opts?: { commit?: boolean }) => void): UseAddPaletteReturn {
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState<number | null>(null)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)

  const requestAdd = useCallback((index: number, anchorEl?: HTMLElement) => {
    setAt(index)
    setAnchor(anchorEl ?? null)
    setOpen(true)
  }, [])

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next)
    if (!next) {
      setAnchor(null)
      setAt(null)
    }
  }, [])

  const onAdd = useCallback((section: Section, index: number) => {
    dispatch({ type: 'addSection', at: index, section }, { commit: true })
    setOpen(false)
    setAnchor(null)
    setAt(null)
  }, [dispatch])

  return { open, at, anchor, requestAdd, onOpenChange, onAdd }
}

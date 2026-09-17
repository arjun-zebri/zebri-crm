// tests/unit/features/proposals/editor/use-add-palette.test.ts
/**
 * Task 8 fix round 1, item 3: `useAddPalette` resets `at` (and `anchor`)
 * back to `null` whenever the palette closes, whether by
 * `onOpenChange(false)` (Escape, backdrop click, Popover dismiss) or by
 * `onAdd` (a section was chosen), so no stale index lingers in state
 * between one close and the next `requestAdd`.
 */
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { newSectionFor, useAddPalette } from '@/features/proposals'

describe('useAddPalette', () => {
  it('opens with the requested index and anchor', () => {
    const dispatch = vi.fn()
    const { result } = renderHook(() => useAddPalette(dispatch))
    const anchor = document.createElement('button')

    act(() => result.current.requestAdd(2, anchor))

    expect(result.current.open).toBe(true)
    expect(result.current.at).toBe(2)
    expect(result.current.anchor).toBe(anchor)
  })

  it('resets at and anchor to null when closed via onOpenChange(false)', () => {
    const dispatch = vi.fn()
    const { result } = renderHook(() => useAddPalette(dispatch))
    const anchor = document.createElement('button')
    act(() => result.current.requestAdd(1, anchor))

    act(() => result.current.onOpenChange(false))

    expect(result.current.open).toBe(false)
    expect(result.current.at).toBeNull()
    expect(result.current.anchor).toBeNull()
  })

  it('resets at and anchor to null after onAdd, alongside the addSection dispatch', () => {
    const dispatch = vi.fn()
    const { result } = renderHook(() => useAddPalette(dispatch))
    const anchor = document.createElement('button')
    act(() => result.current.requestAdd(0, anchor))

    const section = newSectionFor('content')
    act(() => result.current.onAdd(section, 0))

    expect(dispatch).toHaveBeenCalledWith({ type: 'addSection', at: 0, section }, { commit: true })
    expect(result.current.open).toBe(false)
    expect(result.current.at).toBeNull()
    expect(result.current.anchor).toBeNull()
  })
})

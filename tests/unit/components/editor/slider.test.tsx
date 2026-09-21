// tests/unit/components/editor/slider.test.tsx
/**
 * Task 9 addition: `Slider`'s optional `onCommit` fires once a drag ends
 * (pointer up), not on every intermediate `onChange` while dragging, and
 * also fires on a keyboard nudge (which has no separate "release" step of
 * its own). It receives the settled value directly rather than the
 * caller re-reading its own `value` prop, which can still be a render
 * behind. The proposal section bar's sliders (Overlay, Padding) rely on
 * this to dispatch transient changes while dragging and a single
 * committed change on release.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Slider } from '@/components/editor'

describe('Slider onCommit', () => {
  it('fires onChange on every pointer move but onCommit only once, on pointer up', () => {
    const onChange = vi.fn()
    const onCommit = vi.fn()
    render(<Slider value={0} min={0} max={100} onChange={onChange} onCommit={onCommit} ariaLabel="Overlay" />)
    const slider = screen.getByRole('slider', { name: 'Overlay' })

    fireEvent.pointerDown(slider, { clientX: 10 })
    expect(onCommit).not.toHaveBeenCalled()

    fireEvent.pointerMove(window, { clientX: 20 })
    fireEvent.pointerMove(window, { clientX: 30 })
    expect(onChange).toHaveBeenCalled()
    expect(onCommit).not.toHaveBeenCalled()

    fireEvent.pointerUp(window)
    expect(onCommit).toHaveBeenCalledTimes(1)
    // The committed value is the last one dragged to (30, on a 0-width
    // track the test never actually lays out, so the mocked getBoundingClientRect
    // below controls the numbers): what matters here is that onCommit's
    // argument matches onChange's very last call, not a stale earlier one.
    expect(onCommit.mock.calls[0]?.[0]).toBe(onChange.mock.calls[onChange.mock.calls.length - 1]?.[0])
  })

  it('fires both onChange and onCommit, with the same value, on a keyboard nudge', () => {
    const onChange = vi.fn()
    const onCommit = vi.fn()
    render(<Slider value={50} min={0} max={100} onChange={onChange} onCommit={onCommit} ariaLabel="Overlay" />)
    const slider = screen.getByRole('slider', { name: 'Overlay' })

    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith(51)
    expect(onCommit).toHaveBeenCalledWith(51)
  })

  it('works with no onCommit passed at all', () => {
    const onChange = vi.fn()
    render(<Slider value={50} min={0} max={100} onChange={onChange} ariaLabel="Overlay" />)
    const slider = screen.getByRole('slider', { name: 'Overlay' })
    expect(() => fireEvent.keyDown(slider, { key: 'ArrowRight' })).not.toThrow()
  })
})

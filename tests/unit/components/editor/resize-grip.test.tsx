/**
 * Unit tests for the shared `ResizeGrip`: reporting values while
 * dragging, snapping to a labelled value with the readout swapping to
 * that label, committing on mouse up, moving by `step` on the arrow keys
 * for keyboard and assistive-tech users, not leaking its window listeners
 * into an unmounted component, and `invert` flipping the drag direction
 * for a "start" edge handle without touching the keyboard path.
 *
 * @module tests/unit/components/editor/resize-grip
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ResizeGrip } from '@/components/editor'

describe('ResizeGrip', () => {
  it('reports values while dragging, snaps, and commits on mouse up', () => {
    const onChange = vi.fn()
    const onCommit = vi.fn()
    render(
      <div style={{ position: 'relative' }}>
        <ResizeGrip axis="y" value={40} min={0} max={240} snaps={[{ value: 48, label: 'Cozy' }]} tolerance={4} format={(v) => `${v}px`} onChange={onChange} onCommit={onCommit} ariaLabel="Section height" />
      </div>,
    )
    const grip = screen.getByRole('slider', { name: 'Section height' })
    fireEvent.mouseDown(grip, { clientY: 100 })
    fireEvent.mouseMove(window, { clientY: 106 })
    expect(onChange).toHaveBeenLastCalledWith(48)
    expect(screen.getByText('Cozy')).toBeInTheDocument()
    fireEvent.mouseUp(window)
    expect(onCommit).toHaveBeenCalledWith(48)
  })
  it('moves by step with the arrow keys', () => {
    const onChange = vi.fn()
    render(<ResizeGrip axis="y" value={40} min={0} max={240} step={8} format={(v) => `${v}px`} onChange={onChange} ariaLabel="Section height" />)
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Section height' }), { key: 'ArrowDown' })
    expect(onChange).toHaveBeenCalledWith(48)
  })
  it('removes its window listeners on unmount so a drag in progress cannot call back into a gone component', () => {
    const onChange = vi.fn()
    const onCommit = vi.fn()
    const { unmount } = render(
      <ResizeGrip axis="y" value={40} min={0} max={240} format={(v) => `${v}px`} onChange={onChange} onCommit={onCommit} ariaLabel="Section height" />,
    )
    fireEvent.mouseDown(screen.getByRole('slider', { name: 'Section height' }), { clientY: 100 })
    unmount()
    fireEvent.mouseMove(window, { clientY: 200 })
    fireEvent.mouseUp(window)
    expect(onChange).not.toHaveBeenCalled()
    expect(onCommit).not.toHaveBeenCalled()
  })
  it('invert flips the drag direction (dragging toward the start edge grows the value) without changing the keyboard step', () => {
    const onChange = vi.fn()
    render(
      <ResizeGrip axis="x" value={40} min={0} max={100} invert format={(v) => `${v}%`} onChange={onChange} ariaLabel="Width, left edge" />,
    )
    const grip = screen.getByRole('slider', { name: 'Width, left edge' })
    fireEvent.mouseDown(grip, { clientX: 100 })
    // Dragging left (toward the start edge) grows the value when inverted.
    fireEvent.mouseMove(window, { clientX: 90 })
    expect(onChange).toHaveBeenLastCalledWith(50)
    // The keyboard path ignores `invert` and reads the (unchanged) `value`
    // prop, not the drag's result: ArrowRight still increases from 40.
    fireEvent.keyDown(grip, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith(41)
  })
})

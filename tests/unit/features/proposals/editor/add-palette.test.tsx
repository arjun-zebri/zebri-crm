// tests/unit/features/proposals/editor/add-palette.test.tsx
/**
 * Task 8 (redesigned to a visual card grid for the Qwilr-parity pass;
 * Presets tab removed per design feedback - it no longer offers preset
 * layouts, only bare section kinds): `AddPalette` lists all seven
 * `SectionKind`s as `LibraryItemCard`s, hands `onAdd` a freshly built
 * section at the requested index, and renders as a `Modal` when no anchor
 * is given (the trailing "Add section" button's path; a Popover with a
 * real anchor element is covered end to end through
 * `section-canvas.test.tsx`).
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AddPalette } from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'

// jsdom has no ResizeObserver; every card's LayoutThumbnail observes its
// own box to compute a scale factor. These tests never assert on
// thumbnail pixel content, so a no-fire stub (never calling back) is enough.
class ResizeObserverStub {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

const branding = buildPublicBranding({ business_name: 'Sam MC' })

describe('AddPalette', () => {
  it('lists all seven section kinds by name', () => {
    render(<AddPalette open at={0} onOpenChange={() => {}} onAdd={() => {}} role="mc" branding={branding} />)
    for (const label of ['Text', 'Packages', 'Gallery', 'Video', 'Testimonials', 'FAQ', 'Accept']) {
      expect(screen.getByRole('button', { name: `Add ${label}` })).toBeInTheDocument()
    }
  })

  it('choosing a card calls onAdd with a freshly built section at the requested index', () => {
    const onAdd = vi.fn()
    render(<AddPalette open at={3} onOpenChange={() => {}} onAdd={onAdd} role="mc" branding={branding} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add Text' }))

    expect(onAdd).toHaveBeenCalledTimes(1)
    const [, at] = onAdd.mock.calls[0] as [unknown, number]
    expect(at).toBe(3)
  })

  it('renders as a dialog (Modal) when opened with no anchor', () => {
    render(<AddPalette open at={0} onOpenChange={() => {}} onAdd={() => {}} role="mc" branding={branding} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<AddPalette open={false} at={null} onOpenChange={() => {}} onAdd={() => {}} role="mc" branding={branding} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add Text' })).toBeNull()
  })

  it('disables every card once atCap is set', () => {
    render(<AddPalette open at={0} onOpenChange={() => {}} onAdd={() => {}} role="mc" branding={branding} atCap />)
    expect(screen.getByRole('button', { name: 'Add Text' })).toHaveAttribute('aria-disabled', 'true')
  })
})

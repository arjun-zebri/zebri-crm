// tests/unit/features/proposals/editor/add-palette.test.tsx
/**
 * Task 8: `AddPalette` lists all seven `SectionKind`s (Sections tab) and
 * all seven `PresetId`s (Presets tab) by name, hands `onAdd` a freshly
 * built section at the requested index, and renders as a `Modal` when no
 * anchor is given (the trailing "Add section" button's path; a Popover
 * with a real anchor element is covered end to end through
 * `section-canvas.test.tsx`).
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AddPalette, PRESET_LABELS, type Section } from '@/features/proposals'

/** A rich-doc JSON node, typed just enough to walk it. */
interface DocNode {
  type?: string
  attrs?: Record<string, unknown>
  content?: DocNode[]
}

/** Every node type appearing anywhere in `node`'s tree, plus every heading level seen. */
function walk(node: DocNode | null | undefined, types: Set<string>, headingLevels: Set<unknown>): void {
  if (!node) return
  if (node.type) types.add(node.type)
  if (node.type === 'heading') headingLevels.add(node.attrs?.level)
  node.content?.forEach((child) => walk(child, types, headingLevels))
}

describe('AddPalette', () => {
  it('lists all seven section kinds by name on the Sections tab', () => {
    render(<AddPalette open at={0} onOpenChange={() => {}} onAdd={() => {}} role="mc" />)
    for (const label of ['Text', 'Packages', 'Gallery', 'Video', 'Testimonials', 'FAQ', 'Accept']) {
      expect(screen.getByRole('menuitem', { name: label })).toBeInTheDocument()
    }
  })

  it('lists all seven presets by label on the Presets tab', () => {
    render(<AddPalette open at={0} onOpenChange={() => {}} onAdd={() => {}} role="mc" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Presets' }))
    for (const { label } of Object.values(PRESET_LABELS)) {
      expect(screen.getByRole('menuitem', { name: new RegExp(`^${label}`) })).toBeInTheDocument()
    }
  })

  it('choosing "How it works" calls onAdd with a section carrying an H2 and a columns node, at the requested index', () => {
    const onAdd = vi.fn()
    render(<AddPalette open at={3} onOpenChange={() => {}} onAdd={onAdd} role="mc" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Presets' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /^How it works/ }))

    expect(onAdd).toHaveBeenCalledTimes(1)
    const [section, at] = onAdd.mock.calls[0] as [Section, number]
    expect(at).toBe(3)

    const types = new Set<string>()
    const levels = new Set<unknown>()
    walk(section.content as DocNode, types, levels)
    expect(types.has('columns')).toBe(true)
    expect(types.has('heading')).toBe(true)
    expect(levels.has(2)).toBe(true)
  })

  it('renders as a dialog (Modal) when opened with no anchor', () => {
    render(<AddPalette open at={0} onOpenChange={() => {}} onAdd={() => {}} role="mc" />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<AddPalette open={false} at={null} onOpenChange={() => {}} onAdd={() => {}} role="mc" />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('menuitem')).toBeNull()
  })

  it('resets to the Sections tab on every reopen, even after leaving it on Presets', () => {
    const { rerender } = render(<AddPalette open at={0} onOpenChange={() => {}} onAdd={() => {}} role="mc" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Presets' }))
    expect(screen.getByRole('menuitem', { name: /^Hero/ })).toBeInTheDocument()

    // Close (Modal unmounts its content; the AddPalette instance itself
    // stays mounted, which is exactly why a stale `tab` could otherwise
    // survive the round trip) and reopen at a different index.
    rerender(<AddPalette open={false} at={null} onOpenChange={() => {}} onAdd={() => {}} role="mc" />)
    rerender(<AddPalette open at={1} onOpenChange={() => {}} onAdd={() => {}} role="mc" />)

    expect(screen.getByRole('menuitem', { name: 'Text' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /^Hero/ })).toBeNull()
  })
})

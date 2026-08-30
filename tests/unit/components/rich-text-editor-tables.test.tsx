/**
 * Table support in the shared rich-text editor.
 *
 * Pinned here:
 *
 * 1. The icon inserts a table directly. It used to open a popover, which both
 *    added a step and (at `z-50`, under a Modal panel at `z-[60]`) rendered
 *    behind the contract builder so the click looked like a no-op.
 * 2. The click really runs `insertTable`. An earlier test only proved the menu
 *    opened, so it missed TableKit not being registered on the live editor
 *    instance: `insertTable is not a function`.
 * 3. Tables are opt-in: surfaces whose renderer has not registered TableKit
 *    must not offer the control, because `generateHTML` throws on an
 *    unregistered node type.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RichTextEditor } from '@/components/ui/rich-text-editor'

const doc = { type: 'doc', content: [{ type: 'paragraph' }] }

describe('RichTextEditor table control', () => {
  it('inserts a table directly, with no menu in the way', async () => {
    // The icon used to open a popover; inserting is the only thing wanted from
    // the toolbar, so it is now a plain button.
    const onChange = vi.fn()
    render(<RichTextEditor value={doc} onChange={onChange} tables />)
    await userEvent.click(await screen.findByTitle('Insert table'))

    await waitFor(() => {
      const emitted = JSON.stringify(onChange.mock.calls.at(-1)?.[0] ?? {})
      expect(emitted).toContain('"table"')
    })
  })

  it('still inserts a table when clicked twice', async () => {
    // The earlier tests only proved the menu opened. `insertTable` is a
    // command contributed by the Table extension, so if TableKit is not really
    // registered the click throws "insertTable is not a function" at runtime.
    const onChange = vi.fn()
    render(<RichTextEditor value={doc} onChange={onChange} tables />)
    const button = await screen.findByTitle('Insert table')
    await userEvent.click(button)
    await userEvent.click(button)

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
      const emitted = JSON.stringify(onChange.mock.calls.at(-1)?.[0] ?? {})
      expect(emitted).toContain('"table"')
    })
  })

  it('offers no table control unless the surface opts in', async () => {
    render(<RichTextEditor value={doc} onChange={vi.fn()} />)
    await screen.findByTitle('Bold')
    expect(screen.queryByTitle('Insert table')).toBeNull()
  })
})

describe('table hover controls', () => {
  it('offers add and delete for the hovered row and column', async () => {
    const onChange = vi.fn()
    render(<RichTextEditor value={doc} onChange={onChange} tables />)
    await userEvent.click(await screen.findByTitle('Insert table'))

    const cell = await waitFor(() => {
      const found = document.querySelector('td, th')
      expect(found).not.toBeNull()
      return found as HTMLElement
    })
    await userEvent.hover(cell)

    expect(await screen.findByTitle('Add column after')).toBeTruthy()
    expect(screen.getByTitle('Delete column')).toBeTruthy()
    expect(screen.getByTitle('Add row below')).toBeTruthy()
    expect(screen.getByTitle('Delete row')).toBeTruthy()
  })

  it('adds a row when the hover control is used', async () => {
    const onChange = vi.fn()
    render(<RichTextEditor value={doc} onChange={onChange} tables />)
    await userEvent.click(await screen.findByTitle('Insert table'))

    const cell = await waitFor(() => {
      const found = document.querySelector('td, th')
      expect(found).not.toBeNull()
      return found as HTMLElement
    })
    await userEvent.hover(cell)

    const rowsBefore = document.querySelectorAll('tr').length
    await userEvent.click(await screen.findByTitle('Add row below'))
    await waitFor(() => {
      expect(document.querySelectorAll('tr').length).toBe(rowsBefore + 1)
    })
  })
})

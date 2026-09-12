/**
 * The numbering-format picker on the shared rich-text editor.
 *
 * Contracts need legal-style numbering (1., 1.1, (a), (i)). The picker sets a
 * `listStyle` attribute on the ordered list under the caret; nested lists are
 * their own nodes, so each level can be styled on its own. It is opt-in like
 * tables: only a surface whose renderer registers the extension and whose CSS
 * draws the markers may offer it.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RichTextEditor } from '@/components/ui/rich-text-editor'

const paragraphDoc = { type: 'doc', content: [{ type: 'paragraph' }] }
const listDoc = {
  type: 'doc',
  content: [
    {
      type: 'orderedList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Deposit' }] }],
        },
      ],
    },
  ],
}

function lastEmitted(onChange: ReturnType<typeof vi.fn>) {
  return JSON.stringify(onChange.mock.calls.at(-1)?.[0] ?? {})
}

describe('RichTextEditor numbering format picker', () => {
  it('offers no picker unless the surface opts in', async () => {
    render(<RichTextEditor value={paragraphDoc} onChange={vi.fn()} />)
    await screen.findByTitle('Numbered list')
    expect(screen.queryByTitle('Numbering format')).toBeNull()
  })

  it('applies the chosen format to the list under the caret', async () => {
    const onChange = vi.fn()
    render(<RichTextEditor value={listDoc} onChange={onChange} listStyles />)
    await userEvent.click(await screen.findByTitle('Numbering format'))
    await userEvent.click(await screen.findByRole('menuitem', { name: /\(a\).*Letters in brackets/ }))

    await waitFor(() => {
      expect(lastEmitted(onChange)).toContain('"listStyle":"lower-alpha-paren"')
    })
  })

  it('shows the format of the list under the caret on the button', async () => {
    // A split button, not a bare chevron: the current glyph makes the control
    // visible and tells the MC what the list they are in is numbered with.
    const styled = {
      ...listDoc,
      content: [{ ...listDoc.content[0], attrs: { listStyle: 'lower-alpha-paren' } }],
    }
    render(<RichTextEditor value={styled} onChange={vi.fn()} listStyles />)
    expect(await screen.findByTitle('Numbering format')).toHaveTextContent('(a)')
  })

  it('shows the plain format outside a list', async () => {
    render(<RichTextEditor value={paragraphDoc} onChange={vi.fn()} listStyles />)
    expect(await screen.findByTitle('Numbering format')).toHaveTextContent('1.')
  })

  it('applies the Legal preset to the whole tree', async () => {
    const onChange = vi.fn()
    render(<RichTextEditor value={listDoc} onChange={onChange} listStyles />)
    await userEvent.click(await screen.findByTitle('Numbering format'))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Legal/ }))

    await waitFor(() => {
      expect(lastEmitted(onChange)).toContain('"listScheme":"legal"')
    })
  })

  it('starts a numbered list when a format is picked outside one', async () => {
    const onChange = vi.fn()
    render(<RichTextEditor value={paragraphDoc} onChange={onChange} listStyles />)
    await userEvent.click(await screen.findByTitle('Numbering format'))
    await userEvent.click(await screen.findByRole('menuitem', { name: /\(i\).*Roman numerals in brackets/ }))

    await waitFor(() => {
      const emitted = lastEmitted(onChange)
      expect(emitted).toContain('"orderedList"')
      expect(emitted).toContain('"listStyle":"lower-roman-paren"')
    })
  })
})

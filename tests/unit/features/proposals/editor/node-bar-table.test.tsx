/**
 * The `table` node bar and the table helpers behind it
 * (`extensions/table-commands.ts`): the bar shows while the caret is in a
 * cell (never a `NodeSelection`), its row / column buttons act on that
 * caret's row and column, the last row / column cannot be deleted from
 * it, and Reset size clears every `colwidth` plus the table height.
 * Same headless harness as `node-bar.test.tsx`: a bare editor built from
 * `buildRichDocExtensions({})`, the table as the doc's sole child so its
 * position is `0`.
 *
 * @module tests/unit/features/proposals/editor/node-bar-table
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { JSONContent } from '@tiptap/core'
import type { Editor } from '@tiptap/react'
import { useEditor } from '@tiptap/react'
import { useEffect } from 'react'
import { describe, expect, it } from 'vitest'

import { buildRichDocExtensions, doc, NodeBar, paragraph, text } from '@/features/proposals'
import { enclosingTablePos, resetTableSize, tableColumnCount, writeTableColumnWidths } from '@/features/proposals/editor/extensions/table-commands'

const cell = (label: string, colwidth?: number[]) => ({ type: 'tableCell', ...(colwidth ? { attrs: { colwidth } } : {}), content: [paragraph(text(label))] })
const row = (...cells: JSONContent[]) => ({ type: 'tableRow', content: cells })
/** A 2×2 table; `pos 4` is inside the first cell's text (table 0 > row 1 > cell 2 > paragraph 3 > text 4). */
const twoByTwo = (attrs?: Record<string, unknown>) => doc({ type: 'table', ...(attrs ? { attrs } : {}), content: [row(cell('a'), cell('b')), row(cell('c'), cell('d'))] })
const FIRST_CELL_TEXT = 4

function Harness({ content, onReady }: { content: JSONContent; onReady: (editor: Editor) => void }) {
  const editor = useEditor({ extensions: buildRichDocExtensions({}), content, immediatelyRender: false })
  useEffect(() => {
    if (!editor) return
    editor.commands.setTextSelection(FIRST_CELL_TEXT)
    onReady(editor)
  }, [editor, onReady])
  if (!editor) return null
  return <NodeBar node={{ sectionId: 's1', nodeType: 'table', pos: 0 }} editor={editor} />
}

async function setup(content: JSONContent): Promise<Editor> {
  let current: Editor | null = null
  render(<Harness content={content} onReady={(e) => { current = e }} />)
  await waitFor(() => expect(current).not.toBeNull())
  return current!
}

const table = (editor: Editor) => editor.state.doc.nodeAt(0)!
const widths = (editor: Editor) => {
  const out: unknown[] = []
  table(editor).descendants((n) => { if (n.type.name === 'tableCell') out.push(n.attrs.colwidth) })
  return out
}

describe('NodeBarTable', () => {
  it('has a Border colour control that writes the table\'s borderColor attr', async () => {
    const editor = await setup(twoByTwo())
    expect(table(editor).attrs.borderColor).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Border colour' }))
    const input = await screen.findByPlaceholderText('#000000')
    fireEvent.change(input, { target: { value: '#123456' } })
    await waitFor(() => expect(table(editor).attrs.borderColor).toBe('#123456'))
  })

  it('shows as the "Table" toolbar while the caret is in a cell, and adds a row below / a column right of it', async () => {
    const editor = await setup(twoByTwo())
    expect(screen.getByRole('toolbar', { name: 'Table' })).toBeInTheDocument()
    expect(enclosingTablePos(editor.state)).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: 'Add row below' }))
    expect(table(editor).childCount).toBe(3)
    // The new row sits after the caret's (first) row, so 'c' is now third.
    expect(table(editor).child(2).textContent).toBe('cd')

    fireEvent.click(screen.getByRole('button', { name: 'Add column right' }))
    expect(tableColumnCount(table(editor))).toBe(3)
    expect(table(editor).child(0).child(2).textContent).toBe('b')
  })

  it('deletes the caret\'s row and column, and disables both at one', async () => {
    const editor = await setup(twoByTwo())
    fireEvent.click(screen.getByRole('button', { name: 'Delete row' }))
    expect(table(editor).childCount).toBe(1)
    expect(table(editor).textContent).toBe('cd')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete row' })).toBeDisabled())

    fireEvent.click(screen.getByRole('button', { name: 'Delete column' }))
    expect(tableColumnCount(table(editor))).toBe(1)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete column' })).toBeDisabled())
    expect(table(editor).textContent).toBe('d')
  })

  it('Remove deletes the whole table', async () => {
    const editor = await setup(twoByTwo())
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(editor.state.doc.nodeAt(0)?.type.name).not.toBe('table')
    expect(enclosingTablePos(editor.state)).toBeNull()
  })

  it('writeTableColumnWidths sets every cell\'s colwidth per column, and Reset size clears them and the height', async () => {
    const editor = await setup(twoByTwo({ height: 300 }))
    writeTableColumnWidths(editor, 0, [120, 200])
    expect(widths(editor)).toEqual([[120], [200], [120], [200]])
    expect(table(editor).attrs.height).toBe(300)

    fireEvent.click(screen.getByRole('button', { name: 'Reset size' }))
    expect(widths(editor)).toEqual([null, null, null, null])
    expect(table(editor).attrs.height).toBeNull()

    // The pure helper is the same path, without the bar.
    writeTableColumnWidths(editor, 0, [90, 90])
    resetTableSize(editor, 0)
    expect(widths(editor)).toEqual([null, null, null, null])
  })

  it('renders nothing when the position no longer holds a table', async () => {
    const editor = await setup(doc(paragraph(text('plain'))))
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(enclosingTablePos(editor.state)).toBeNull()
  })
})

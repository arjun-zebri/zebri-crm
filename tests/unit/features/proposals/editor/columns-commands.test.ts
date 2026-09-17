// tests/unit/features/proposals/editor/columns-commands.test.ts
/**
 * Task 11: `setColumnCount` and `resetColumnRatios`
 * (`extensions/columns-commands.ts`), the `columns` node bar's 2/3 pill
 * and Reset ratio button. Exercised directly against a bare
 * `@tiptap/core` `Editor`, mirroring `slash-menu.test.ts`'s own
 * non-React harness.
 */
import { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { describe, expect, it } from 'vitest'

import { buildRichDocExtensions, column, columns, doc, paragraph, text } from '@/features/proposals'

/** The `columns` node at position 0, the position every fixture below places it at. */
function columnsNode(editor: Editor): ProseMirrorNode {
  const node = editor.state.doc.nodeAt(0)
  if (!node) throw new Error('expected a node at position 0')
  return node
}

describe('setColumnCount', () => {
  it('grows 2 -> 3 by appending an equal-ratio column with an empty paragraph', () => {
    const editor = new Editor({
      extensions: buildRichDocExtensions({}),
      content: doc(columns(column(0.5, paragraph(text('A'))), column(0.5, paragraph(text('B'))))),
    })

    expect(editor.commands.setColumnCount(3, 0)).toBe(true)

    const node = columnsNode(editor)
    expect(node.attrs.count).toBe(3)
    expect(node.childCount).toBe(3)
    node.forEach((child) => expect(child.attrs.ratio).toBeCloseTo(1 / 3, 2))
    // The two original columns keep their content; the new one is an empty paragraph.
    expect(node.child(0).textContent).toBe('A')
    expect(node.child(1).textContent).toBe('B')
    expect(node.child(2).child(0).type.name).toBe('paragraph')
    expect(node.child(2).textContent).toBe('')
    editor.destroy()
  })

  it("shrinks 3 -> 2 by moving the last column's content into its neighbour", () => {
    const editor = new Editor({
      extensions: buildRichDocExtensions({}),
      content: doc(
        columns(
          column(1 / 3, paragraph(text('A'))),
          column(1 / 3, paragraph(text('B'))),
          column(1 / 3, paragraph(text('C'))),
        ),
      ),
    })

    expect(editor.commands.setColumnCount(2, 0)).toBe(true)

    const node = columnsNode(editor)
    expect(node.attrs.count).toBe(2)
    expect(node.childCount).toBe(2)
    node.forEach((child) => expect(child.attrs.ratio).toBeCloseTo(0.5, 2))
    expect(node.child(0).textContent).toBe('A')
    // B's content moves into its neighbour alongside C's, not discarded.
    expect(node.child(1).textContent).toBe('BC')
    editor.destroy()
  })

  it('is a no-op that still returns true when the row is already at `count`', () => {
    const editor = new Editor({
      extensions: buildRichDocExtensions({}),
      content: doc(columns(column(0.5, paragraph(text('A'))), column(0.5, paragraph(text('B'))))),
    })

    expect(editor.commands.setColumnCount(2, 0)).toBe(true)
    expect(columnsNode(editor).childCount).toBe(2)
    editor.destroy()
  })

  it('returns false when no `columns` node is found at `pos`', () => {
    const editor = new Editor({ extensions: buildRichDocExtensions({}), content: doc(paragraph(text('A'))) })
    expect(editor.commands.setColumnCount(3, 0)).toBe(false)
    editor.destroy()
  })
})

describe('resetColumnRatios', () => {
  it('sets every column back to an equal ratio', () => {
    const editor = new Editor({
      extensions: buildRichDocExtensions({}),
      content: doc(columns(column(0.2, paragraph(text('A'))), column(0.8, paragraph(text('B'))))),
    })

    expect(editor.commands.resetColumnRatios(0)).toBe(true)
    columnsNode(editor).forEach((child) => expect(child.attrs.ratio).toBeCloseTo(0.5, 2))
    editor.destroy()
  })

  it('returns false when no `columns` node is found at `pos`', () => {
    const editor = new Editor({ extensions: buildRichDocExtensions({}), content: doc(paragraph(text('A'))) })
    expect(editor.commands.resetColumnRatios(0)).toBe(false)
    editor.destroy()
  })
})

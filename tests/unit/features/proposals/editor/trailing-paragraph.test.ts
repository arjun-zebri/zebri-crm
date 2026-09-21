/**
 * A table cell or a column never ends in a block atom: once an image
 * (spacer, embed, button…) lands as the last thing in one, an empty
 * paragraph follows it, so there is always somewhere to click and type
 * (2026-09-19: "inserting an image makes it the only thing you can
 * insert into the cell"). The doc root already has TipTap's own
 * `trailingNode`; this is the same rule for the nested containers.
 *
 * @module tests/unit/features/proposals/editor/trailing-paragraph
 */
import { Editor } from '@tiptap/react'
import { describe, expect, it } from 'vitest'

import { buildRichDocExtensions, column, columns, doc, image, paragraph, text } from '@/features/proposals'

const IMG = { src: 'https://x.supabase.co/storage/v1/object/public/proposal-media/u/a.jpg', alt: '', layout: 'inline' as const, widthPct: 100 }
const cell = (...content: object[]) => ({ type: 'tableCell', content })
const table = (...cells: object[]) => ({ type: 'table', content: [{ type: 'tableRow', content: cells }] })

function names(editor: Editor, path: number[]): string[] {
  let node = editor.state.doc
  for (const i of path) node = node.child(i)
  return node.content.content.map((n) => n.type.name)
}

describe('trailing paragraph inside cells and columns', () => {
  it('an image inserted into an empty cell gets an empty paragraph after it; a cell already ending in text is left alone', () => {
    const editor = new Editor({ extensions: buildRichDocExtensions({}), content: doc(table(cell(paragraph()), cell(paragraph(text('b'))))) })
    // Position 3 is inside the first cell's empty paragraph.
    editor.commands.insertContentAt({ from: 3, to: 3 }, image(IMG))
    expect(names(editor, [0, 0, 0])).toEqual(['image', 'paragraph'])
    expect(names(editor, [0, 0, 1])).toEqual(['paragraph'])
  })

  it('applies to a column too, and to a document loaded with a trailing atom already in a cell', async () => {
    const editor = new Editor({
      extensions: buildRichDocExtensions({}),
      content: doc(table(cell(image(IMG))), columns(column(0.5, image(IMG)), column(0.5, paragraph(text('r'))))),
    })
    // The initial doc is repaired on `create`, which TipTap emits on the next tick.
    await new Promise((r) => setTimeout(r, 0))
    expect(names(editor, [0, 0, 0])).toEqual(['image', 'paragraph'])
    expect(names(editor, [1, 0])).toEqual(['image', 'paragraph'])
    expect(names(editor, [1, 1])).toEqual(['paragraph'])
  })
})

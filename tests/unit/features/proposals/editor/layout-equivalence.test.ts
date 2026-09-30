/**
 * `sameDocument`, the guard standing between "the editor was opened" and
 * "a proposal exists". It has to say yes to everything mounting the
 * canvas does on its own, and no to anything the MC does.
 *
 * @module tests/unit/features/proposals/editor/layout-equivalence
 */
import { describe, expect, it } from 'vitest'

import { doc, paragraph, sameDocument, text, type ProposalLayout } from '@/features/proposals'

/** A one-section layout whose content is whatever is passed in. */
function withContent(content: object, style: object = { height: 'fit' }): ProposalLayout {
  return { version: 2, sections: [{ id: 's1', kind: 'content', style, content } as never] }
}

describe('sameDocument', () => {
  it('ignores the key order the editor rebuilds objects in', () => {
    const a = withContent(doc(paragraph(text('Hello'))), { height: 'fit', padding: 'cozy', align: 'center' })
    const b = withContent(doc(paragraph(text('Hello'))), { align: 'center', padding: 'cozy', height: 'fit' })
    expect(sameDocument(a, b)).toBe(true)
  })

  it('ignores the empty paragraph TipTap appends to a document that does not end in one', () => {
    const before = withContent({ type: 'doc', content: [{ type: 'image', attrs: { src: 'x' } }] })
    const after = withContent({ type: 'doc', content: [{ type: 'image', attrs: { src: 'x' } }, { type: 'paragraph' }] })
    expect(sameDocument(before, after)).toBe(true)
  })

  it('ignores the same repair inside a column or a table cell', () => {
    const before = withContent({
      type: 'doc',
      content: [{ type: 'columns', content: [{ type: 'column', content: [{ type: 'image', attrs: { src: 'x' } }] }] }],
    })
    const after = withContent({
      type: 'doc',
      content: [
        { type: 'columns', content: [{ type: 'column', content: [{ type: 'image', attrs: { src: 'x' } }, { type: 'paragraph', content: [] }] }] },
        { type: 'paragraph' },
      ],
    })
    expect(sameDocument(before, after)).toBe(true)
  })

  it('sees a word the MC typed', () => {
    const before = withContent(doc(paragraph(text('Hello'))))
    const after = withContent(doc(paragraph(text('Hello you two'))))
    expect(sameDocument(before, after)).toBe(false)
  })

  it('sees a style change, a new section and a removed one', () => {
    const base = withContent(doc(paragraph(text('Hi'))))
    expect(sameDocument(base, withContent(doc(paragraph(text('Hi'))), { height: 'full' }))).toBe(false)
    expect(sameDocument(base, { version: 2, sections: [] })).toBe(false)
    expect(sameDocument(base, { ...base, sections: [...base.sections, ...base.sections] })).toBe(false)
  })

  it('does not mistake a trailing paragraph with words in it for an empty one', () => {
    const before = withContent({ type: 'doc', content: [{ type: 'image', attrs: { src: 'x' } }] })
    const after = withContent({ type: 'doc', content: [{ type: 'image', attrs: { src: 'x' } }, paragraph(text('and then'))] })
    expect(sameDocument(before, after)).toBe(false)
  })
})

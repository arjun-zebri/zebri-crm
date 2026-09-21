// tests/unit/features/proposals/model/doc.test.ts
/**
 * `docText`: the plain-text projection the packages editor stores for a
 * card title or line description typed through an `InlineField`.
 */
import { describe, expect, it } from 'vitest'

import { doc, docText, heading, paragraph, text, variable } from '@/features/proposals'

describe('docText', () => {
  it('joins text nodes in order, blocks separated by one space, trimmed', () => {
    expect(docText(doc(paragraph(text('Hello '), text('there')), heading(2, text('Again'))))).toBe('Hello there Again')
    expect(docText(doc(paragraph()))).toBe('')
    expect(docText(null)).toBe('')
  })

  it('writes a variable chip as its template token, with or without a fallback', () => {
    expect(docText(doc(paragraph(text('Hi '), variable('couple_name'))))).toBe('Hi {{couple_name}}')
    expect(docText(doc(paragraph(variable('couple_name', 'you two'))))).toBe('{{couple_name | you two}}')
    expect(docText({ type: 'variable', attrs: {} })).toBe('')
  })
})

/**
 * Mustache text ↔ mention-bearing doc.
 *
 * The editor only resolves mention nodes, and the runner only stores
 * strings, so anything that loses fidelity in either direction ends
 * up in front of a couple: a variable that arrives as literal text is
 * mailed as `{{couple.name}}`, and one that flattens wrongly is
 * written to their record that way.
 */
import { describe, expect, it } from 'vitest'

import { docToText, textToDoc, type DocNode } from '@/lib/automations/mustache-doc'

/** The inline nodes of the first paragraph. */
function inline(doc: DocNode) {
  return doc.content?.[0]?.content ?? []
}

describe('textToDoc', () => {
  it('turns a variable into a mention, keeping the text around it', () => {
    const doc = textToDoc('Hi {{couple.primary_name}}, welcome')
    expect(inline(doc)).toEqual([
      { type: 'text', text: 'Hi ' },
      { type: 'mention', attrs: { id: 'couple.primary_name' } },
      { type: 'text', text: ', welcome' },
    ])
  })

  it('keeps a filter on the expression', () => {
    // The filter is part of the id the editor's own picker inserts.
    expect(inline(textToDoc('On {{event.date | friendly}}'))[1]).toEqual({
      type: 'mention',
      attrs: { id: 'event.date | friendly' },
    })
  })

  it('tolerates spaces inside the braces', () => {
    expect(inline(textToDoc('Hi {{ couple.name }}'))[1]).toEqual({
      type: 'mention',
      attrs: { id: 'couple.name' },
    })
  })

  it('does not let one variable swallow the next', () => {
    const nodes = inline(textToDoc('{{couple.name}} and {{couple.spouse_name}}'))
    expect(nodes.map((n) => n.type)).toEqual(['mention', 'text', 'mention'])
    expect(nodes[1]).toEqual({ type: 'text', text: ' and ' })
  })

  it('gives an empty string a doc with somewhere to put the caret', () => {
    expect(textToDoc('')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
  })

  it('makes one paragraph per line', () => {
    expect(textToDoc('one\ntwo').content).toHaveLength(2)
  })
})

describe('docToText', () => {
  it('round-trips a note through the editor and back', () => {
    const original = 'Hi {{couple.primary_name}},\n\nSee you on {{event.date | friendly}}.'
    expect(docToText(textToDoc(original))).toBe(original)
  })

  it('drops a mention that lost its id', () => {
    // A corrupted node would otherwise write "{{undefined}}" onto the
    // couple's record.
    const doc: DocNode = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi ' }, { type: 'mention' }] }],
    }
    expect(docToText(doc)).toBe('Hi')
  })

  it('is empty for an empty doc', () => {
    expect(docToText(textToDoc(''))).toBe('')
    expect(docToText(null)).toBe('')
  })
})

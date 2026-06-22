/**
 * `toPlainJSON` tests — the fix for mention `attrs` being dropped by
 * React Server Action serialisation.
 *
 * ProseMirror's `editor.getJSON()` returns node `attrs` as null-prototype
 * objects; React's server-action argument serialisation keeps only plain
 * objects, silently dropping null-prototype ones (so a mention's variable
 * id was lost on save, persisting `{{null}}`). `toPlainJSON` normalises
 * the whole tree to plain objects before it leaves the editor.
 */
import { describe, expect, it } from 'vitest'

import { toPlainJSON } from '@/lib/utils'

describe('toPlainJSON', () => {
  it('normalises a null-prototype object to a plain object', () => {
    const nullProto = Object.assign(Object.create(null), { id: 'couple.primary_name', label: null })
    expect(Object.getPrototypeOf(nullProto)).toBeNull()

    const plain = toPlainJSON(nullProto)
    expect(Object.getPrototypeOf(plain)).toBe(Object.prototype)
    expect(plain).toEqual({ id: 'couple.primary_name', label: null })
  })

  it('normalises null-prototype attrs nested inside a tiptap doc', () => {
    const mentionAttrs = Object.assign(Object.create(null), { id: 'couple.primary_name' })
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'mention', attrs: mentionAttrs }] }],
    }
    // Sanity: the nested attrs start with a null prototype.
    const before = (doc.content[0]!.content![0] as { attrs: object }).attrs
    expect(Object.getPrototypeOf(before)).toBeNull()

    const plain = toPlainJSON(doc)
    const after = (plain.content[0]!.content![0] as { attrs: object }).attrs
    expect(Object.getPrototypeOf(after)).toBe(Object.prototype)
    expect(plain).toEqual(doc)
  })
})

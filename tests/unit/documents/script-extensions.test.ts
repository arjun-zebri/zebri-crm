import type { JSONContent } from '@tiptap/core'
import { generateJSON } from '@tiptap/html'
import { describe, expect, it } from 'vitest'

import { renderScriptHtml, SCRIPT_EXTENSIONS, scriptDocEquals, scriptPlainText, stableStringify } from '@/lib/documents/script-extensions'

const doc = (content: JSONContent[]): JSONContent => ({ type: 'doc', content })
const para = (content: JSONContent[]): JSONContent => ({ type: 'paragraph', content })
const text = (t: string, marks?: JSONContent['marks']): JSONContent => ({ type: 'text', text: t, ...(marks ? { marks } : {}) })

/** Names and passages a bilingual celebrant actually writes. */
const UNICODE = ['Nguyễn Thị Ánh', 'Đặng', 'Zoë', 'Ελένη', 'Дмитрий', '阮氏映', 'こんにちは', '안녕하세요']

describe('script schema', () => {
  it('round-trips diacritics, Greek, Cyrillic and CJK text through HTML and back', () => {
    const d = doc(UNICODE.map((s) => para([text(s)])))
    const html = renderScriptHtml(d)
    for (const s of UNICODE) expect(html).toContain(s)
    // Parsing the HTML back and rendering again is a fixed point: nothing
    // about the text or structure is lost on the way through the sanitizer.
    const back = generateJSON(html, SCRIPT_EXTENSIONS)
    expect(renderScriptHtml(back)).toBe(html)
    expect(scriptPlainText(back)).toBe(UNICODE.join('\n'))
  })

  it('round-trips a page break, a font-family mark and a font size', () => {
    const d = doc([
      para([text('Before', [{ type: 'textStyle', attrs: { fontFamily: '"Lora"', fontSize: '32px' } }])]),
      { type: 'pageBreak' },
      para([text('After')]),
    ])
    const html = renderScriptHtml(d)
    expect(html).toContain('<hr data-page-break="">')
    // TipTap emits the family unquoted; the sanitizer keeps it as is.
    expect(html).toContain('font-family:Lora')
    expect(html).toContain('font-size:32px')
    const back = generateJSON(html, SCRIPT_EXTENSIONS)
    expect(back.content?.[1]).toEqual({ type: 'pageBreak' })
    expect(back.content?.[0]?.content?.[0]?.marks?.[0]?.attrs).toMatchObject({ fontFamily: 'Lora', fontSize: '32px' })
  })

  it('has no variable node: a script is written for one couple, not merged', () => {
    expect(SCRIPT_EXTENSIONS.some((e) => e.name === 'variable')).toBe(false)
    const d = doc([para([text('Do you, '), { type: 'variable', attrs: { id: 'couple_name' } }])])
    // Unknown node: renders empty rather than throwing.
    expect(renderScriptHtml(d)).toBe('')
  })

  it('compares documents by structure, not key order (jsonb reorders keys)', () => {
    const emitted = doc([para([text('Hi')])])
    const fromDb = { content: [{ content: [{ text: 'Hi', type: 'text' }], type: 'paragraph' }], type: 'doc' } as JSONContent
    expect(JSON.stringify(emitted)).not.toBe(JSON.stringify(fromDb))
    expect(scriptDocEquals(emitted, fromDb)).toBe(true)
    expect(scriptDocEquals(emitted, doc([para([text('Hi!')])]))).toBe(false)
    expect(stableStringify({ b: [1, { z: null, a: 'x' }], a: 1 })).toBe('{"a":1,"b":[1,{"a":"x","z":null}]}')
  })

  it('strips a smuggled script tag but keeps the text', () => {
    const d = doc([para([text('<script>alert(1)</script>safe')])])
    const out = renderScriptHtml(d)
    expect(out).not.toContain('<script')
    expect(out).toContain('safe')
  })

  it('renders malformed content as empty rather than throwing', () => {
    expect(renderScriptHtml({ type: 'doc', content: [{ type: 'nope' }] })).toBe('')
    expect(renderScriptHtml(null)).toBe('')
  })

  it('extracts plain text with one line per block', () => {
    const d = doc([para([text('One')]), { type: 'heading', attrs: { level: 1 }, content: [text('Two')] }])
    expect(scriptPlainText(d)).toBe('One\nTwo')
  })
})

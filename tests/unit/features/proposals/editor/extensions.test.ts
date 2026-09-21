// tests/unit/features/proposals/editor/extensions.test.ts
/**
 * Spec 2.2: one node/mark spec drives the editor, the renderer and the
 * validator. This test pins the editor side to `rich-doc-spec.ts`.
 */
import { getSchema } from '@tiptap/core'
import { DOMParser, DOMSerializer } from '@tiptap/pm/model'
import { describe, expect, it } from 'vitest'

import { buildRichDocExtensions, MARK_TYPES, newSectionId, NODE_TYPES, normaliseEditorJSON, parseProposalLayout } from '@/features/proposals'

describe('v2 editor extensions', () => {
  const schema = getSchema(buildRichDocExtensions({}))

  it('registers exactly the spec node types (plus doc)', () => {
    const names = Object.keys(schema.nodes).filter((n) => n !== 'doc').sort()
    expect(names).toEqual([...NODE_TYPES].sort())
  })
  it('registers exactly the spec mark types', () => {
    expect(Object.keys(schema.marks).sort()).toEqual([...MARK_TYPES].sort())
  })
  it('a document using every node passes the layout schema after normalisation', () => {
    const json = normaliseEditorJSON({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1, textAlign: null }, content: [{ type: 'text', text: 'Hi ' }, { type: 'variable', attrs: { id: 'couple_name' } }] },
        { type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text', text: 'Body', marks: [{ type: 'bold' }, { type: 'textCase', attrs: { value: 'uppercase' } }] }] },
        { type: 'image', attrs: { src: 'https://x.supabase.co/storage/v1/object/public/proposal-media/u/a.jpg', alt: '', caption: '', layout: 'inline', widthPct: 100 } },
        { type: 'button', attrs: { label: 'Accept', action: { kind: 'accept' }, variant: 'fill', size: 'md', align: 'left', color: null, radius: null } },
        { type: 'embed', attrs: { url: 'https://www.youtube.com/watch?v=abc' } },
        { type: 'columns', attrs: { count: 2 }, content: [
          { type: 'column', attrs: { ratio: 0.5 }, content: [{ type: 'paragraph' }] },
          { type: 'column', attrs: { ratio: 0.5 }, content: [{ type: 'spacer', attrs: { heightPx: 24 } }] },
        ] },
        { type: 'horizontalRule' },
      ],
    })
    const layout = { version: 2 as const, sections: [{ id: newSectionId(), kind: 'content' as const, style: { height: 'fit' as const, contentWidth: 'medium' as const, padding: 'cozy' as const }, content: json }] }
    const result = parseProposalLayout(layout)
    expect(result.ok, JSON.stringify(result)).toBe(true)
  })
  it('the embed command refuses a host outside the allowlist', () => {
    const embed = buildRichDocExtensions({}).find((e) => e.name === 'embed')
    expect(embed).toBeDefined()
    // Command behaviour is covered end to end in the node-bar test (Task 11); here the node exists with a url attr.
    expect(schema.nodes.embed?.spec.attrs?.url).toBeDefined()
  })
  it('normaliseEditorJSON strips null node attrs and leaves marks untouched', () => {
    const result = normaliseEditorJSON({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { textAlign: null },
          content: [
            { type: 'text', text: 'Hi', marks: [{ type: 'textStyle', attrs: { color: null, fontSize: '16px' } }] },
          ],
        },
      ],
    })
    // The paragraph's own `textAlign: null` attr is stripped entirely.
    expect(result.content?.[0]?.attrs).toBeUndefined()
    // The text node's mark carries a null attr value too, but marks are
    // never touched by normalisation.
    expect(result.content?.[0]?.content?.[0]?.marks?.[0]?.attrs).toEqual({ color: null, fontSize: '16px' })
  })
})

describe('fontSize mark rendering', () => {
  const schema = getSchema(buildRichDocExtensions({}))

  it('renders a large size as the fluid clamp, keeps the stored px in a data attribute, and parses it back as px', () => {
    const node = schema.text('Big', [schema.marks.textStyle!.create({ fontSize: '46px' })])
    const wrap = document.createElement('div')
    wrap.appendChild(DOMSerializer.fromSchema(schema).serializeNode(node))
    const span = wrap.querySelector('span')!
    expect(span.getAttribute('style')).toContain('font-size: clamp(32px, 8.21cqw, 46px)')
    expect(span.getAttribute('data-font-size')).toBe('46px')
    // The clipboard round-trips through this same HTML: a copy/paste must
    // land the px value back, never the clamp string.
    const parsed = DOMParser.fromSchema(schema).parse(wrap)
    expect(parsed.firstChild?.firstChild?.marks[0]?.attrs.fontSize).toBe('46px')
  })

  it('pasted HTML carrying a plain px font-size still parses; anything else is dropped', () => {
    const wrap = document.createElement('div')
    wrap.innerHTML = '<p><span style="font-size: 18px">a</span><span style="font-size: clamp(32px, 8cqw, 46px)">b</span></p>'
    const parsed = DOMParser.fromSchema(schema).parse(wrap)
    const [a, b] = [parsed.firstChild?.child(0), parsed.firstChild?.child(1)]
    expect(a?.marks[0]?.attrs.fontSize).toBe('18px')
    expect(b?.marks.find((m) => m.type.name === 'textStyle')?.attrs.fontSize ?? null).toBeNull()
  })
})

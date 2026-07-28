import type { JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'

import { renderRichText, richContentToPlainText } from '@/lib/branding/render-rich-text'

const doc = (content: JSONContent[]): JSONContent => ({ type: 'doc', content })
const para = (content: JSONContent[]): JSONContent => ({ type: 'paragraph', content })
const text = (t: string, marks?: JSONContent['marks']): JSONContent => ({ type: 'text', text: t, ...(marks ? { marks } : {}) })
const variable = (id: string): JSONContent => ({ type: 'variable', attrs: { id } })

describe('renderRichText', () => {
  it('renders plain text', () => {
    expect(renderRichText(doc([para([text('Hello')])]))).toBe('<p>Hello</p>')
  })

  it('renders a bold mark', () => {
    expect(renderRichText(doc([para([text('Hi', [{ type: 'bold' }])])]))).toBe(
      '<p><strong>Hi</strong></p>',
    )
  })

  it('resolves a variable chip to its escaped value', () => {
    const d = doc([para([text('Dear '), variable('couple_name')])])
    expect(renderRichText(d, { couple_name: 'Sarah & James' })).toBe('<p>Dear Sarah &amp; James</p>')
  })

  it('resolves a missing variable to empty, never a raw chip', () => {
    const d = doc([para([text('Due '), variable('due_date')])])
    const out = renderRichText(d, {})
    expect(out).not.toContain('data-variable')
    expect(out).not.toContain('{{')
  })

  it('renders a validated colour mark and strips nothing legitimate', () => {
    const d = doc([para([text('x', [{ type: 'textStyle', attrs: { color: '#C0392B' } }])])])
    expect(renderRichText(d)).toContain('color:#C0392B')
  })

  it('returns empty string for empty/nullish content', () => {
    expect(renderRichText(null)).toBe('')
    expect(renderRichText(undefined)).toBe('')
  })

  it('treats a legacy plain string as escaped text', () => {
    expect(renderRichText('a < b')).toBe('a &lt; b')
  })

  it('extracts plain text', () => {
    const d = doc([para([text('Dear '), variable('couple_name')])])
    expect(richContentToPlainText(d, )).toBe('Dear')
  })
})

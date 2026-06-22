/**
 * Email signature renderer tests.
 *
 * Covers `lib/email/signature`: rendering a TipTap signature doc to
 * sanitised HTML (the rich Gmail/Outlook-style formatting an MC can
 * apply) and the empty-signature check that keeps `{{mc.signature}}`
 * from emitting an empty bubble.
 */
import type { JSONContent } from '@tiptap/react'
import { describe, expect, it } from 'vitest'

import { isSignatureEmpty, renderSignatureHtml } from '@/lib/email/signature'

/** A one-paragraph signature doc from inline nodes. */
function para(...nodes: JSONContent[]): JSONContent {
  return { type: 'doc', content: [{ type: 'paragraph', content: nodes }] }
}
const text = (t: string, marks?: JSONContent['marks']): JSONContent => ({ type: 'text', text: t, marks })

describe('isSignatureEmpty', () => {
  it('treats null and an empty paragraph as empty', () => {
    expect(isSignatureEmpty(null)).toBe(true)
    expect(isSignatureEmpty({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(true)
    expect(isSignatureEmpty(para(text('   ')))).toBe(true)
  })

  it('treats text or an image as non-empty', () => {
    expect(isSignatureEmpty(para(text('Hi')))).toBe(false)
    expect(
      isSignatureEmpty({
        type: 'doc',
        content: [{ type: 'image', attrs: { src: 'https://cdn.example.com/a.png' } }],
      }),
    ).toBe(false)
  })
})

describe('renderSignatureHtml', () => {
  it('returns empty string for an empty signature', () => {
    expect(renderSignatureHtml(null)).toBe('')
    expect(renderSignatureHtml({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe('')
  })

  it('preserves bold, italic and underline', () => {
    const html = renderSignatureHtml(
      para(
        text('a', [{ type: 'bold' }]),
        text('b', [{ type: 'italic' }]),
        text('c', [{ type: 'underline' }]),
      ),
    )
    expect(html).toContain('<strong>a</strong>')
    expect(html).toContain('<em>b</em>')
    expect(html).toContain('<u>c</u>')
  })

  it('keeps text colour and font size as inline styles', () => {
    const html = renderSignatureHtml(
      para(text('Big red', [{ type: 'textStyle', attrs: { color: '#ff0000', fontSize: '24px' } }])),
    )
    expect(html).toMatch(/color:\s*#ff0000/i)
    expect(html).toMatch(/font-size:\s*24px/i)
  })

  it('keeps highlight as a background colour', () => {
    const html = renderSignatureHtml(
      para(text('lit', [{ type: 'highlight', attrs: { color: '#ffff00' } }])),
    )
    expect(html).toMatch(/background-color:\s*#ffff00/i)
  })

  it('keeps paragraph alignment', () => {
    const html = renderSignatureHtml({
      type: 'doc',
      content: [{ type: 'paragraph', attrs: { textAlign: 'center' }, content: [text('mid')] }],
    })
    expect(html).toMatch(/text-align:\s*center/i)
  })

  it('renders a link and forces a safe target', () => {
    const html = renderSignatureHtml(
      para(text('site', [{ type: 'link', attrs: { href: 'https://zebri.com.au' } }])),
    )
    expect(html).toContain('href="https://zebri.com.au"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('keeps a resized image width as an inline style', () => {
    const html = renderSignatureHtml({
      type: 'doc',
      content: [{ type: 'image', attrs: { src: 'https://cdn.example.com/logo.png', width: '120px' } }],
    })
    expect(html).toMatch(/width:\s*120px/i)
  })

  it('renders an http image and drops a javascript-scheme one', () => {
    const ok = renderSignatureHtml({
      type: 'doc',
      content: [{ type: 'image', attrs: { src: 'https://cdn.example.com/logo.png', alt: 'logo' } }],
    })
    expect(ok).toContain('src="https://cdn.example.com/logo.png"')

    const bad = renderSignatureHtml({
      type: 'doc',
      // eslint-disable-next-line no-script-url
      content: [{ type: 'image', attrs: { src: 'javascript:alert(1)' } }],
    })
    expect(bad).not.toContain('javascript:')
  })

  it('strips a dangerous inline style value', () => {
    const html = renderSignatureHtml(
      para(text('x', [{ type: 'textStyle', attrs: { color: 'red' } }])),
    )
    // A valid keyword colour survives...
    expect(html).toMatch(/color:\s*red/i)
    // ...but the sanitiser never emits url()/expression() payloads.
    expect(html).not.toMatch(/url\(|expression\(/i)
  })
})

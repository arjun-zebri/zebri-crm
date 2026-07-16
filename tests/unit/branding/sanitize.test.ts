import { describe, expect, it } from 'vitest'

import { htmlToPlainText, sanitizeHtml } from '@/lib/branding/sanitize'

describe('sanitizeHtml', () => {
  it('keeps allowed inline tags and strips attributes', () => {
    expect(sanitizeHtml('<b class="x" onclick="evil()">hi</b>')).toBe('<b>hi</b>')
  })

  it('strips disallowed tags but keeps their text', () => {
    expect(sanitizeHtml('<h1>Big</h1> <a href="x">link</a>')).toBe('Big link')
  })

  it('removes script/style/iframe content entirely', () => {
    expect(sanitizeHtml('a<script>bad()</script>b')).toBe('ab')
  })

  it('escapes stray angle brackets in text', () => {
    expect(sanitizeHtml('1 < 2 & 3 > 2')).toBe('1 &lt; 2 &amp; 3 &gt; 2')
  })

  it('closes unbalanced tags so output is well-formed', () => {
    expect(sanitizeHtml('<b>bold <i>both</b>')).toBe('<b>bold <i>both</i></b>')
  })

  it('drops orphan closing tags', () => {
    expect(sanitizeHtml('plain</b> text')).toBe('plain text')
  })

  it('converts list tags to inline when allowLists is false', () => {
    expect(sanitizeHtml('<ul><li>a</li></ul>', { allowLists: false })).toBe('a')
  })

  it('normalizes br variants', () => {
    expect(sanitizeHtml('a<br/>b<BR >c')).toBe('a<br>b<br>c')
  })

  it('is identical regardless of environment (no window dependence)', () => {
    // The implementation must not reference window/DOMParser at all.
    const src = readFileSyncUtf8()
    expect(src).not.toMatch(/DOMParser|typeof window/)
    function readFileSyncUtf8() {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('node:fs') as typeof import('node:fs')
      return fs.readFileSync('lib/branding/sanitize.ts', 'utf8')
    }
  })
})

describe('htmlToPlainText', () => {
  it('strips all tags and decodes entities', () => {
    expect(htmlToPlainText('<p>Hi&nbsp;<b>there</b> &amp; you</p>')).toBe('Hi there & you')
  })
})

import { describe, expect, it } from 'vitest'

import { sanitizeRichHtml } from '@/lib/branding/rich-text-sanitize'

describe('sanitizeRichHtml — allowed content', () => {
  it('keeps basic marks and paragraphs', () => {
    expect(sanitizeRichHtml('<p><strong>Hi</strong> <em>there</em></p>')).toBe(
      '<p><strong>Hi</strong> <em>there</em></p>',
    )
  })

  it('keeps a validated colour', () => {
    expect(sanitizeRichHtml('<span style="color:#C0392B">x</span>')).toBe(
      '<span style="color:#C0392B">x</span>',
    )
    expect(sanitizeRichHtml('<span style="color:rgb(10, 20, 30)">x</span>')).toBe(
      '<span style="color:rgb(10, 20, 30)">x</span>',
    )
  })

  it('keeps a validated font-size within bounds and drops out-of-range', () => {
    expect(sanitizeRichHtml('<span style="font-size:24px">x</span>')).toBe(
      '<span style="font-size:24px">x</span>',
    )
    expect(sanitizeRichHtml('<span style="font-size:900px">x</span>')).toBe('<span>x</span>')
  })

  it('keeps a known variable chip and its id', () => {
    expect(sanitizeRichHtml('<span data-variable="couple_name"></span>')).toBe(
      '<span data-variable="couple_name"></span>',
    )
  })

  it('drops an unknown variable id', () => {
    expect(sanitizeRichHtml('<span data-variable="evil"></span>')).toBe('<span></span>')
  })

  it('keeps a text-align on a paragraph', () => {
    expect(sanitizeRichHtml('<p style="text-align:center">x</p>')).toBe(
      '<p style="text-align:center">x</p>',
    )
  })

  it('keeps a safe link and forces rel/target', () => {
    expect(sanitizeRichHtml('<a href="https://ex.com">x</a>')).toBe(
      '<a href="https://ex.com" rel="noopener nofollow" target="_blank">x</a>',
    )
  })
})

describe('sanitizeRichHtml — attacks are neutralised', () => {
  it('strips script tags and their content', () => {
    expect(sanitizeRichHtml('a<script>alert(1)</script>b')).toBe('ab')
  })

  it('drops a javascript: link', () => {
    // eslint-disable-next-line no-script-url
    expect(sanitizeRichHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>')
  })

  it('drops url() / expression() smuggled into a colour', () => {
    expect(sanitizeRichHtml('<span style="color:url(javascript:alert(1))">x</span>')).toBe(
      '<span>x</span>',
    )
    expect(sanitizeRichHtml('<span style="background-color:expression(alert(1))">x</span>')).toBe(
      '<span>x</span>',
    )
  })

  it('drops a disallowed style property (position/behavior)', () => {
    expect(sanitizeRichHtml('<span style="position:fixed;color:#000">x</span>')).toBe(
      '<span style="color:#000">x</span>',
    )
  })

  it('drops an onerror / arbitrary attribute', () => {
    expect(sanitizeRichHtml('<span onerror="alert(1)" onclick="x">y</span>')).toBe('<span>y</span>')
  })

  it('drops a font-family containing parentheses (function smuggling)', () => {
    expect(sanitizeRichHtml('<span style="font-family:url(x)">y</span>')).toBe('<span>y</span>')
  })

  it('strips img/iframe/svg entirely', () => {
    expect(sanitizeRichHtml('<img src=x onerror=alert(1)>')).toBe('')
    expect(sanitizeRichHtml('<iframe src="evil"></iframe>ok')).toBe('ok')
    expect(sanitizeRichHtml('<svg><script>x</script></svg>after')).toBe('after')
  })

  it('escapes stray angle brackets in text', () => {
    expect(sanitizeRichHtml('1 < 2 && 3 > 2')).toBe('1 &lt; 2 &amp;&amp; 3 &gt; 2')
  })
})

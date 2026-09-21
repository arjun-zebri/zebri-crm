import { describe, expect, it } from 'vitest'

import { resolveVariablesInHtml } from '@/lib/branding/resolve-variables'

describe('resolveVariablesInHtml', () => {
  it('replaces a chip with its display value', () => {
    const html = 'Dear <span data-variable="couple_name"></span>,'
    expect(resolveVariablesInHtml(html, { couple_name: 'Sarah & James' })).toBe(
      'Dear Sarah &amp; James,',
    )
  })

  it('resolves a missing value to empty, never a raw chip', () => {
    const html = 'Due <span data-variable="due_date"></span>.'
    expect(resolveVariablesInHtml(html, {})).toBe('Due .')
    expect(resolveVariablesInHtml(html, {})).not.toContain('data-variable')
    expect(resolveVariablesInHtml(html, {})).not.toContain('{{')
  })

  it('renders the chip fallback when the value is empty, and the value when it is not', () => {
    const html = 'Hi <span data-variable="couple_name" data-fallback="you two"></span>!'
    expect(resolveVariablesInHtml(html, {})).toBe('Hi you two!')
    expect(resolveVariablesInHtml(html, { couple_name: '' })).toBe('Hi you two!')
    expect(resolveVariablesInHtml(html, { couple_name: 'Ada & Bo' })).toBe('Hi Ada &amp; Bo!')
  })

  it('escapes a fallback and decodes entities the serialiser put in the attribute', () => {
    const html = '<span data-fallback="&lt;b&gt; &amp; you" data-variable="couple_name"></span>'
    expect(resolveVariablesInHtml(html, {})).toBe('&lt;b&gt; &amp; you')
  })

  it('leaves marks wrapping the chip intact so the value inherits formatting', () => {
    const html = '<strong style="color:#900"><span data-variable="couple_name"></span></strong>'
    expect(resolveVariablesInHtml(html, { couple_name: 'Ada' })).toBe(
      '<strong style="color:#900">Ada</strong>',
    )
  })

  it('resolves multiple and repeated chips', () => {
    const html =
      '<span data-variable="couple_name"></span> & <span data-variable="couple_name"></span> — <span data-variable="total"></span>'
    expect(
      resolveVariablesInHtml(html, { couple_name: 'A', total: '$100.00' }),
    ).toBe('A & A — $100.00')
  })

  it('escapes a value that contains HTML so it cannot inject markup', () => {
    const html = '<span data-variable="couple_name"></span>'
    expect(resolveVariablesInHtml(html, { couple_name: '<img src=x onerror=alert(1)>' })).toBe(
      '&lt;img src=x onerror=alert(1)&gt;',
    )
  })

  it('tolerates extra attributes on the chip span', () => {
    const html = '<span class="v" data-variable="abn" data-x="1"></span>'
    expect(resolveVariablesInHtml(html, { abn: '12 345' })).toBe('12 345')
  })

  it('returns empty string for empty input', () => {
    expect(resolveVariablesInHtml('', { a: 'b' })).toBe('')
  })
})

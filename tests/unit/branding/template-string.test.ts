import { describe, expect, it } from 'vitest'

import { insertTemplateToken, resolveTemplateString } from '@/lib/branding/template-string'

describe('resolveTemplateString', () => {
  it('replaces {{ id }} with the value', () => {
    expect(resolveTemplateString('Book {{couple_name}} now', { couple_name: 'Ada & Bo' })).toBe('Book Ada & Bo now')
    expect(resolveTemplateString('Book {{ couple_name }}', { couple_name: 'Ada' })).toBe('Book Ada')
  })

  it('uses the | fallback when the value is empty or unknown, else empty', () => {
    expect(resolveTemplateString('Hi {{couple_name | you two}}!', {})).toBe('Hi you two!')
    expect(resolveTemplateString('Hi {{couple_name|you two}}!', { couple_name: '' })).toBe('Hi you two!')
    expect(resolveTemplateString('Hi {{couple_name}}!', {})).toBe('Hi !')
    expect(resolveTemplateString('Hi {{nope | there}}!', {})).toBe('Hi there!')
  })

  it('leaves text with no tokens untouched', () => {
    expect(resolveTemplateString('Accept proposal', { couple_name: 'x' })).toBe('Accept proposal')
    expect(resolveTemplateString('', {})).toBe('')
  })
})

describe('insertTemplateToken', () => {
  it('inserts {{ id }} at the caret, with a space on either side only where needed', () => {
    expect(insertTemplateToken('Book now', 5, 'couple_name')).toEqual({ value: 'Book {{couple_name}} now', caret: 20 })
    expect(insertTemplateToken('', 0, 'venue')).toEqual({ value: '{{venue}}', caret: 9 })
    expect(insertTemplateToken('Hi', 2, 'venue')).toEqual({ value: 'Hi {{venue}}', caret: 12 })
  })
})

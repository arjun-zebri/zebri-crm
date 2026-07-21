/**
 * Unit tests for the text-case helpers that drive the branding "Case" control.
 *
 * Sentence case is the interesting one: CSS has no value for it and CSS
 * ::first-letter does not apply to the inline <span>s most labels render as, so
 * it is done as a string rewrite (applyCase). These tests pin that rewrite and
 * confirm the CSS helper stays out of its way.
 */
import { describe, it, expect } from 'vitest'

import { applyCase, cssTextTransform } from '@/lib/branding/text-case'

describe('cssTextTransform', () => {
  it('passes CSS-native cases through unchanged', () => {
    expect(cssTextTransform('none')).toBe('none')
    expect(cssTextTransform('uppercase')).toBe('uppercase')
    expect(cssTextTransform('lowercase')).toBe('lowercase')
    expect(cssTextTransform('capitalize')).toBe('capitalize')
  })

  it('emits no CSS transform for sentence case (handled by applyCase)', () => {
    expect(cssTextTransform('sentence')).toBe('none')
  })

  it('treats undefined as none', () => {
    expect(cssTextTransform(undefined)).toBe('none')
  })
})

describe('applyCase', () => {
  it('leaves non-sentence cases untouched (CSS handles them)', () => {
    expect(applyCase('Account Name', 'none')).toBe('Account Name')
    expect(applyCase('Account Name', 'uppercase')).toBe('Account Name')
    expect(applyCase('Account Name', 'lowercase')).toBe('Account Name')
    expect(applyCase('Account Name', 'capitalize')).toBe('Account Name')
    expect(applyCase('Account Name', undefined)).toBe('Account Name')
  })

  it('sentence case capitalises the first letter and lowercases the rest', () => {
    expect(applyCase('INVOICE No 4', 'sentence')).toBe('Invoice no 4')
    expect(applyCase('account name', 'sentence')).toBe('Account name')
    expect(applyCase('Account Name', 'sentence')).toBe('Account name')
  })

  it('flattens acronyms deliberately (the As-typed pill is the escape hatch)', () => {
    expect(applyCase('BSB', 'sentence')).toBe('Bsb')
  })

  it('capitalises the first character only, leaving leading digits/symbols be', () => {
    expect(applyCase('4 weeks', 'sentence')).toBe('4 weeks')
    expect(applyCase('#tag', 'sentence')).toBe('#tag')
  })

  it('handles empty strings without throwing', () => {
    expect(applyCase('', 'sentence')).toBe('')
  })
})

import { describe, expect, it } from 'vitest'

import { resolveTextStyle, type TextStyleDefaults } from '@/app/(dashboard)/branding/blocks/text-style'

describe('resolveTextStyle', () => {
  const base: TextStyleDefaults = {
    fontFamily: 'inter',
    fontSize: 16,
    fontWeight: 400,
    color: '#000000',
    align: 'left',
    lineHeight: 1.5,
    letterSpacing: 0,
  }

  it('resolves textTransform from style, defaulting to none', () => {
    const result = resolveTextStyle({ textTransform: 'uppercase' }, base)
    expect(result.textTransform).toBe('uppercase')
  })

  it('defaults textTransform to none when not specified', () => {
    const result = resolveTextStyle({}, base)
    expect(result.textTransform).toBe('none')
  })

  it('resolves other styles unchanged', () => {
    const result = resolveTextStyle({ textTransform: 'capitalize' }, base)
    expect(result.textTransform).toBe('capitalize')
    expect(result.fontSize).toBe('16px')
  })
})

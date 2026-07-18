import { describe, expect, it } from 'vitest'

import { MIN_FONT_PX, roleSizePx } from '@/lib/branding/type-scale'

describe('roleSizePx', () => {
  it('returns the documented sizes at the default 32 / 15 settings', () => {
    expect(roleSizePx('docTitle', 32, 15)).toBe(32)
    expect(roleSizePx('sectionHeading', 32, 15)).toBe(20)
    expect(roleSizePx('total', 32, 15)).toBe(18)
    expect(roleSizePx('subtitle', 32, 15)).toBe(15)
    expect(roleSizePx('body', 32, 15)).toBe(15)
    expect(roleSizePx('finePrint', 32, 15)).toBe(12)
    expect(roleSizePx('sectionLabel', 32, 15)).toBe(11)
  })

  it('scales heading roles when heading size changes', () => {
    expect(roleSizePx('docTitle', 40, 15)).toBe(40)
    expect(roleSizePx('sectionHeading', 40, 15)).toBe(25)
  })

  it('scales body roles when body size changes', () => {
    expect(roleSizePx('body', 32, 20)).toBe(20)
    expect(roleSizePx('finePrint', 32, 20)).toBe(16)
  })

  it('rounds to whole pixels', () => {
    expect(Number.isInteger(roleSizePx('sectionLabel', 32, 17))).toBe(true)
  })

  it('clamps to the legibility floor', () => {
    expect(roleSizePx('finePrint', 32, 10)).toBe(MIN_FONT_PX)
    expect(roleSizePx('sectionLabel', 32, 10)).toBe(MIN_FONT_PX)
  })
})

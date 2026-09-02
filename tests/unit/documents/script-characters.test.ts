import { describe, expect, it } from 'vitest'

import { SCRIPT_CHARACTER_GROUPS } from '@/lib/documents/script-characters'

describe('script characters', () => {
  it('offers the Vietnamese tone letters and Māori macrons, precomposed, with no duplicates in a group', () => {
    const vi = SCRIPT_CHARACTER_GROUPS.find((g) => g.label === 'Vietnamese')!
    expect([...vi.chars]).toHaveLength(67)
    for (const ch of 'ễđắ') expect(vi.chars).toContain(ch)
    expect(vi.chars.normalize('NFC')).toBe(vi.chars)
    expect(SCRIPT_CHARACTER_GROUPS.find((g) => g.label.startsWith('Māori'))!.chars).toContain('ā')
    for (const g of SCRIPT_CHARACTER_GROUPS) expect(new Set([...g.chars]).size).toBe([...g.chars].length)
  })
})

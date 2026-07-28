import { describe, expect, it } from 'vitest'

import { FONT_IDS, FONT_LABELS, FONT_STACKS, GOOGLE_FONT_FAMILIES } from '@/lib/branding/fonts'

describe('font catalogue', () => {
  it('has at least 30 fonts, each fully described', () => {
    expect(FONT_IDS.length).toBeGreaterThanOrEqual(30)
    for (const id of FONT_IDS) {
      expect(FONT_LABELS[id]).toBeTruthy()
      expect(FONT_STACKS[id]).toContain(',')
      expect(GOOGLE_FONT_FAMILIES[id]).toBeTruthy()
    }
  })
})

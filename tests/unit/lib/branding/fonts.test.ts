import { describe, expect, it } from 'vitest'

import {
  BODY_FONTS, FONT_IDS, FONT_LABELS, FONT_STACKS, fontIdFromStack, GOOGLE_FONT_FAMILIES, HEADING_FONTS, SCRIPT_FONT_IDS,
} from '@/lib/branding/fonts'

describe('font catalogue', () => {
  it('has at least 30 fonts, each fully described', () => {
    expect(FONT_IDS.length).toBeGreaterThanOrEqual(30)
    for (const id of FONT_IDS) {
      expect(FONT_LABELS[id]).toBeTruthy()
      expect(FONT_STACKS[id]).toContain(',')
      expect(GOOGLE_FONT_FAMILIES[id]).toBeTruthy()
    }
  })

  it('offers script (cursive) faces that fall back to a generic cursive', () => {
    expect(SCRIPT_FONT_IDS.length).toBeGreaterThanOrEqual(6)
    for (const id of SCRIPT_FONT_IDS) {
      expect(FONT_IDS).toContain(id)
      expect(FONT_STACKS[id]).toMatch(/cursive$/)
    }
  })

  it('lets a heading use a script face but never a body', () => {
    for (const id of SCRIPT_FONT_IDS) {
      expect(HEADING_FONTS).toContain(id)
      expect(BODY_FONTS).not.toContain(id)
    }
    expect(BODY_FONTS.length).toBe(FONT_IDS.length - SCRIPT_FONT_IDS.length)
  })
})

describe('fontIdFromStack', () => {
  it('maps a catalogue stack back to its id', () => {
    for (const id of FONT_IDS) expect(fontIdFromStack(FONT_STACKS[id])).toBe(id)
  })

  it('returns null for an unset or unknown stack', () => {
    expect(fontIdFromStack(null)).toBeNull()
    expect(fontIdFromStack('')).toBeNull()
    expect(fontIdFromStack('Comic Sans MS, cursive')).toBeNull()
  })
})

/**
 * Presets are content / data sections the palette inserts in one click
 * (spec D4, §3). Each must validate on its own and carry fresh ids.
 *
 * @module tests/unit/features/proposals/model/presets
 */
import { describe, expect, it } from 'vitest'

import { defaultTemplateLayout, parseProposalLayout, PRESET_IDS, PRESET_LABELS, presetSection } from '@/features/proposals'

describe('presets', () => {
  it('every preset validates as a one-section layout and has a label', () => {
    for (const id of PRESET_IDS) {
      const section = presetSection(id, 'mc')
      expect(parseProposalLayout({ version: 2, sections: [section] })).toEqual(expect.objectContaining({ ok: true }))
      expect(PRESET_LABELS[id].label.length).toBeGreaterThan(0)
    }
  })

  it('gives each insertion a fresh id', () => {
    expect(presetSection('hero').id).not.toBe(presetSection('hero').id)
  })

  it('the default template has exactly one accept and opens with the hero', () => {
    for (const role of ['mc', 'celebrant', 'both'] as const) {
      const layout = defaultTemplateLayout(role)
      expect(parseProposalLayout(layout).ok).toBe(true)
      expect(layout.sections[0]?.name).toBe('Hero')
      expect(layout.sections.filter((s) => s.kind === 'accept')).toHaveLength(1)
      expect(layout.sections.at(-1)?.name).toBe('Footer')
    }
  })

  // UX audit §3.1: the starter hero has no cover photo, so without a fill
  // the first screen a new account sees is an empty viewport-tall box.
  it('the default template opens with a real hero fill, not an empty box', () => {
    const layout = defaultTemplateLayout('mc')
    expect(layout.sections[0]?.style.background).toEqual({ color: '#111827' })
    expect(layout.sections[0]?.style.textColor).toBe('#FFFFFF')
  })
})

/**
 * The "Use a template" gallery's starter catalogue (UX audit §3.9): five
 * starters that each build a valid layout, plus the blank "Start from
 * scratch" layout.
 *
 * @module tests/unit/features/proposals/model/starters
 */
import { describe, expect, it } from 'vitest'

import {
  blankTemplateLayout, KIND_LABELS, newSectionFor, parseProposalLayout, STARTER_CATEGORIES, TEMPLATE_STARTERS,
} from '@/features/proposals'

describe('TEMPLATE_STARTERS', () => {
  it('has exactly five starters', () => {
    expect(TEMPLATE_STARTERS).toHaveLength(5)
  })

  it('every starter builds a layout that validates', () => {
    for (const starter of TEMPLATE_STARTERS) {
      const layout = starter.build()
      const result = parseProposalLayout(layout)
      expect(result.ok, `${starter.id}: ${result.ok ? '' : result.issues.join('; ')}`).toBe(true)
    }
  })

  it('gives each build() call fresh section ids', () => {
    for (const starter of TEMPLATE_STARTERS) {
      const first = starter.build()
      const second = starter.build()
      expect(first.sections.map((s) => s.id)).not.toEqual(second.sections.map((s) => s.id))
    }
  })

  it('"Short and sweet" keeps only Hero, Note, Packages, Accept, Footer', () => {
    const layout = TEMPLATE_STARTERS.find((s) => s.id === 'short-and-sweet')!.build()
    const labels = layout.sections.map((s) => s.name ?? KIND_LABELS[s.kind])
    expect(labels).toEqual(['Hero', 'Note', 'Packages', 'Accept', 'Footer'])
  })

  it('"Packages first" leads with pricing, ahead of About me', () => {
    const layout = TEMPLATE_STARTERS.find((s) => s.id === 'packages-first')!.build()
    const labels = layout.sections.map((s) => s.name ?? KIND_LABELS[s.kind])
    expect(labels).toEqual(['Hero', 'Packages', 'About me', 'Testimonials', 'Accept', 'Footer'])
  })

  it('"Reception MC" / "Ceremony celebrant" / "Ceremony and reception" match their role starter', () => {
    const byId = Object.fromEntries(TEMPLATE_STARTERS.map((s) => [s.id, s]))
    expect(byId['reception-mc']!.build().sections[0]?.name).toBe('Hero')
    expect(byId['ceremony-celebrant']!.category).toBe('celebrant')
    expect(byId['ceremony-and-reception']!.category).toBe('both')
  })
})

describe('blankTemplateLayout', () => {
  it('is one empty content section', () => {
    const layout = blankTemplateLayout()
    expect(layout.sections).toHaveLength(1)
    expect(layout.sections[0]?.kind).toBe('content')
    expect(layout.sections[0]?.content).toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [] }] })
  })

  it('matches the shape the palette\'s "Text" item creates', () => {
    const fromStarter = blankTemplateLayout().sections[0]!
    const fromPalette = newSectionFor('content')
    expect({ ...fromStarter, id: 'x' }).toEqual({ ...fromPalette, id: 'x' })
  })

  it('validates and mints a fresh id every call', () => {
    expect(parseProposalLayout(blankTemplateLayout()).ok).toBe(true)
    expect(blankTemplateLayout().sections[0]?.id).not.toBe(blankTemplateLayout().sections[0]?.id)
  })
})

describe('STARTER_CATEGORIES', () => {
  it('starts with an "All" chip covering every starter category', () => {
    expect(STARTER_CATEGORIES[0]).toEqual({ id: 'all', label: 'All' })
    const chipIds = new Set(STARTER_CATEGORIES.map((c) => c.id))
    for (const starter of TEMPLATE_STARTERS) expect(chipIds.has(starter.category)).toBe(true)
  })
})

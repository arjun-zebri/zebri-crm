// tests/unit/features/proposals/editor/library-items.test.ts
/**
 * The add palette's card data (`sectionLibraryEntries`,
 * `presetLibraryEntries`): one entry per `SectionKind`/`PresetId`, each
 * with a ready-to-render single-section layout.
 */
import { describe, expect, it } from 'vitest'

import {
  PRESET_IDS, presetLibraryEntries, sectionLibraryEntries, SECTION_ITEMS,
} from '@/features/proposals'

describe('sectionLibraryEntries', () => {
  it('has one entry per SectionKind, matching palette-body\'s SECTION_ITEMS', () => {
    const entries = sectionLibraryEntries('mc')
    expect(entries).toHaveLength(SECTION_ITEMS.length)
    expect(entries.map((e) => e.id)).toEqual(SECTION_ITEMS.map((i) => i.kind))
    expect(entries.map((e) => e.label)).toEqual(SECTION_ITEMS.map((i) => i.label))
  })

  it('wraps a section of the same kind in a single-section v2 layout for LayoutThumbnail', () => {
    const [first] = sectionLibraryEntries('mc')
    expect(first!.layout.version).toBe(2)
    expect(first!.layout.sections).toHaveLength(1)
    expect(first!.layout.sections[0]!.kind).toBe(first!.build().kind)
  })

  it('build() mints a fresh section id on every call', () => {
    const [first] = sectionLibraryEntries('mc')
    expect(first!.build().id).not.toBe(first!.build().id)
    const [preset] = presetLibraryEntries('mc')
    expect(preset!.build().id).not.toBe(preset!.build().id)
  })

  it('carries no description (only presets have one)', () => {
    expect(sectionLibraryEntries('mc').every((e) => e.description === undefined)).toBe(true)
  })
})

describe('presetLibraryEntries', () => {
  it('has one entry per PresetId, each with a label and description', () => {
    const entries = presetLibraryEntries('mc')
    expect(entries).toHaveLength(PRESET_IDS.length)
    expect(entries.map((e) => e.id)).toEqual([...PRESET_IDS])
    expect(entries.every((e) => typeof e.label === 'string' && e.label.length > 0)).toBe(true)
    expect(entries.every((e) => typeof e.description === 'string' && e.description.length > 0)).toBe(true)
  })
})

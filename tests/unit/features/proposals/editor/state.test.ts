/**
 * The layout editor reducer: one pure function over `{ layout, selection }`.
 * Every action gets at least one case; the cap, id-regeneration, bounds and
 * reset rules each get their own.
 *
 * @module tests/unit/features/proposals/editor/state
 */
import { describe, expect, it } from 'vitest'

import {
  defaultTemplateLayout, LAYOUT_LIMITS, layoutReducer, newSectionFor, type LayoutEditorState,
} from '@/features/proposals'

const base = (): LayoutEditorState => ({ layout: defaultTemplateLayout('mc'), selection: { sectionId: null, node: null }, externalVersion: 0 })

describe('newSectionFor', () => {
  it('builds an empty content section with the kind default style', () => {
    const section = newSectionFor('content')
    expect(section.kind).toBe('content')
    expect(section.style).toEqual({ height: 'fit', contentWidth: 'medium', padding: 'cozy' })
    expect(section.content).toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [] }] })
  })

  it('builds a data section for each data kind, matching its own kind', () => {
    for (const kind of ['packages', 'gallery', 'video', 'testimonials', 'faq', 'accept'] as const) {
      const section = newSectionFor(kind)
      expect(section.kind).toBe(kind)
      expect(section.data?.kind).toBe(kind)
    }
  })

  it('builds a preset section', () => {
    const section = newSectionFor({ preset: 'hero' })
    expect(section.name).toBe('Hero')
  })

  it('gives every call a fresh id', () => {
    expect(newSectionFor('content').id).not.toBe(newSectionFor('content').id)
  })
})

describe('layoutReducer', () => {
  it('adds a content section at an index and selects it', () => {
    const s = layoutReducer(base(), { type: 'addSection', at: 1, section: newSectionFor('content') })
    expect(s.layout.sections[1]?.kind).toBe('content')
    expect(s.selection.sectionId).toBe(s.layout.sections[1]?.id)
  })

  it('refuses the 41st section', () => {
    let s = base()
    while (s.layout.sections.length < LAYOUT_LIMITS.maxSections) s = layoutReducer(s, { type: 'addSection', at: 0, section: newSectionFor('content') })
    const before = s.layout
    expect(layoutReducer(s, { type: 'addSection', at: 0, section: newSectionFor('content') }).layout).toBe(before)
  })

  it('duplicate gets a fresh id and lands directly below', () => {
    const s0 = base()
    const id = s0.layout.sections[0]!.id
    const s = layoutReducer(s0, { type: 'duplicateSection', id })
    expect(s.layout.sections[1]?.id).not.toBe(id)
    expect(s.layout.sections[1]?.kind).toBe(s0.layout.sections[0]!.kind)
    expect(s.layout.sections).toHaveLength(s0.layout.sections.length + 1)
    // Controller decision: the copy becomes the selection, matching `addSection`.
    expect(s.selection.sectionId).toBe(s.layout.sections[1]?.id)
  })

  it('duplicating an unknown id is a no-op', () => {
    const s0 = base()
    expect(layoutReducer(s0, { type: 'duplicateSection', id: 'missing' })).toBe(s0)
  })

  it('delete clears a selection pointing at the section', () => {
    const s0 = base()
    const id = s0.layout.sections[0]!.id
    const s = layoutReducer(layoutReducer(s0, { type: 'select', sectionId: id }), { type: 'deleteSection', id })
    expect(s.selection.sectionId).toBeNull()
    expect(s.layout.sections.find((sec) => sec.id === id)).toBeUndefined()
  })

  it('delete leaves an unrelated selection alone', () => {
    const s0 = base()
    const keep = s0.layout.sections[1]!.id
    const doomed = s0.layout.sections[0]!.id
    const selected = layoutReducer(s0, { type: 'select', sectionId: keep })
    const s = layoutReducer(selected, { type: 'deleteSection', id: doomed })
    expect(s.selection.sectionId).toBe(keep)
  })

  it('select sets the section selection and clears any node selection', () => {
    const s0 = base()
    const id = s0.layout.sections[0]!.id
    const withNode = layoutReducer(s0, { type: 'selectNode', node: { sectionId: id, nodeType: 'paragraph', pos: 3 } })
    const s = layoutReducer(withNode, { type: 'select', sectionId: id })
    expect(s.selection).toEqual({ sectionId: id, node: null })
  })

  it('selectNode sets both the node and its owning section', () => {
    const s0 = base()
    const id = s0.layout.sections[0]!.id
    const s = layoutReducer(s0, { type: 'selectNode', node: { sectionId: id, nodeType: 'heading', pos: 0 } })
    expect(s.selection).toEqual({ sectionId: id, node: { sectionId: id, nodeType: 'heading', pos: 0 } })
  })

  it('moveSection reorders sections', () => {
    const s0 = base()
    const firstId = s0.layout.sections[0]!.id
    const s = layoutReducer(s0, { type: 'moveSection', from: 0, to: 2 })
    expect(s.layout.sections[2]?.id).toBe(firstId)
    expect(s.layout.sections).toHaveLength(s0.layout.sections.length)
  })

  it('moveSection clamps an out-of-range destination instead of dropping the section', () => {
    const s0 = base()
    const firstId = s0.layout.sections[0]!.id
    const s = layoutReducer(s0, { type: 'moveSection', from: 0, to: 999 })
    expect(s.layout.sections.at(-1)?.id).toBe(firstId)
    expect(s.layout.sections).toHaveLength(s0.layout.sections.length)
  })

  it('moveSection from an out-of-range source is a no-op', () => {
    const s0 = base()
    expect(layoutReducer(s0, { type: 'moveSection', from: 99, to: 0 })).toBe(s0)
  })

  it('updateStyle merges a patch into the section style', () => {
    const s0 = base()
    const id = s0.layout.sections[0]!.id
    const s = layoutReducer(s0, { type: 'updateStyle', id, patch: { height: 'full' } })
    const section = s.layout.sections.find((sec) => sec.id === id)!
    expect(section.style.height).toBe('full')
    expect(section.style.contentWidth).toBe(s0.layout.sections[0]!.style.contentWidth)
  })

  it('resetStyle restores the kind default, discarding a custom style', () => {
    const s0 = base()
    const id = s0.layout.sections[0]!.id
    const kind = s0.layout.sections[0]!.kind
    const styled = layoutReducer(s0, { type: 'updateStyle', id, patch: { height: 'full', padding: 'roomy' } })
    const s = layoutReducer(styled, { type: 'resetStyle', id })
    const section = s.layout.sections.find((sec) => sec.id === id)!
    expect(section.style).toEqual(newSectionFor(kind).style)
  })

  it('setContent replaces a content section’s rich doc', () => {
    let s0 = base()
    s0 = layoutReducer(s0, { type: 'addSection', at: 0, section: newSectionFor('content') })
    const id = s0.layout.sections[0]!.id
    const nextDoc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }] }
    const s = layoutReducer(s0, { type: 'setContent', id, content: nextDoc })
    expect(s.layout.sections.find((sec) => sec.id === id)?.content).toEqual(nextDoc)
  })

  it('setContent on a data section is a no-op', () => {
    const s0 = base()
    const dataSection = s0.layout.sections.find((sec) => sec.kind !== 'content')!
    const s = layoutReducer(s0, { type: 'setContent', id: dataSection.id, content: { type: 'doc', content: [] } })
    expect(s).toBe(s0)
  })

  it('setName renames a section', () => {
    const s0 = base()
    const id = s0.layout.sections[0]!.id
    const s = layoutReducer(s0, { type: 'setName', id, name: 'Custom name' })
    expect(s.layout.sections.find((sec) => sec.id === id)?.name).toBe('Custom name')
  })

  it('toggleHideOnMobile flips the flag from unset to true and back', () => {
    const s0 = base()
    const id = s0.layout.sections[0]!.id
    const on = layoutReducer(s0, { type: 'toggleHideOnMobile', id })
    expect(on.layout.sections.find((sec) => sec.id === id)?.hideOnMobile).toBe(true)
    const off = layoutReducer(on, { type: 'toggleHideOnMobile', id })
    expect(off.layout.sections.find((sec) => sec.id === id)?.hideOnMobile).toBe(false)
  })

  it('replaceLayout swaps the whole layout and clears the selection', () => {
    const s0 = base()
    const id = s0.layout.sections[0]!.id
    const selected = layoutReducer(s0, { type: 'select', sectionId: id })
    const fresh = defaultTemplateLayout('celebrant')
    const s = layoutReducer(selected, { type: 'replaceLayout', layout: fresh })
    expect(s.layout).toBe(fresh)
    expect(s.selection).toEqual({ sectionId: null, node: null })
  })
})

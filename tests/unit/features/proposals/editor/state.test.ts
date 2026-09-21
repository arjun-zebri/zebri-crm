/**
 * The layout editor reducer: one pure function over `{ layout, selection }`.
 * Every action gets at least one case; the cap, id-regeneration, bounds and
 * reset rules each get their own.
 *
 * @module tests/unit/features/proposals/editor/state
 */
import { describe, expect, it } from 'vitest'

import {
  applyThemePatch, defaultTemplateLayout, defaultTheme, isSectionEmpty, KIND_LABELS, LAYOUT_LIMITS, layoutReducer, newSectionFor, type LayoutEditorState, type SectionData,
} from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const base = (): LayoutEditorState => ({ layout: defaultTemplateLayout('mc'), selection: { sectionId: null, node: null }, externalVersion: 0 })

describe('newSectionFor', () => {
  it('builds an empty content section that inherits padding and text colour from the theme', () => {
    const section = newSectionFor('content')
    expect(section.kind).toBe('content')
    // Width, padding and text colour all inherit from the theme.
    expect(section.style).toEqual({ height: 'fit' })
    expect(section.style.padding).toBeUndefined()
    expect(section.style.textColor).toBeUndefined()
    expect(section.content).toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [] }] })
  })

  it('builds a data section for each data kind, matching its own kind', () => {
    for (const kind of ['packages', 'gallery', 'video', 'testimonials', 'faq', 'accept'] as const) {
      const section = newSectionFor(kind)
      expect(section.kind).toBe(kind)
      expect(section.data?.kind).toBe(kind)
    }
  })

  it('builds a page break carrying neither content nor data, and counts it as empty for the delete flow', () => {
    const section = newSectionFor('pageBreak')
    expect(section.kind).toBe('pageBreak')
    expect(section.content).toBeUndefined()
    expect(section.data).toBeUndefined()
    expect(isSectionEmpty(section)).toBe(true)
    expect(KIND_LABELS.pageBreak).toBe('Page break')
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

  it('updateStyle stores a value equal to the page default as "inherit", so the section keeps following Global style', () => {
    const s0: LayoutEditorState = { ...base(), layout: { ...base().layout, theme: defaultTheme(buildPublicBranding({ business_name: 'Sam MC' })) } }
    const id = s0.layout.sections[0]!.id
    const s = layoutReducer(s0, { type: 'updateStyle', id, patch: { padding: 'cozy', paddingX: 32 } })
    const section = s.layout.sections.find((sec) => sec.id === id)!
    expect(section.style.padding).toBeUndefined()
    expect(section.style.paddingX).toBeUndefined()
    const s2 = layoutReducer(s0, { type: 'updateStyle', id, patch: { padding: 'roomy' } })
    expect(s2.layout.sections.find((sec) => sec.id === id)!.style.padding).toBe('roomy')
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

  it('setData replaces a data section’s data when the kind matches', () => {
    let s0 = base()
    s0 = layoutReducer(s0, { type: 'addSection', at: 0, section: newSectionFor('faq') })
    const id = s0.layout.sections[0]!.id
    const original = s0.layout.sections[0]!.data as Extract<SectionData, { kind: 'faq' }>
    const nextData: SectionData = { kind: 'faq', faq: { ...original.faq, items: [{ id: 'q1', question: 'When do you arrive?', answer: 'An hour early.' }] } }
    const s = layoutReducer(s0, { type: 'setData', id, data: nextData })
    expect(s.layout.sections.find((sec) => sec.id === id)?.data).toEqual(nextData)
  })

  it('setData is a no-op when the payload kind does not match the section’s own kind', () => {
    let s0 = base()
    s0 = layoutReducer(s0, { type: 'addSection', at: 0, section: newSectionFor('faq') })
    const id = s0.layout.sections[0]!.id
    const s = layoutReducer(s0, {
      type: 'setData',
      id,
      data: { kind: 'accept', accept: { buttonLabel: 'Accept' } },
    })
    expect(s).toBe(s0)
  })

  it('setData on a content section is a no-op', () => {
    let s0 = base()
    s0 = layoutReducer(s0, { type: 'addSection', at: 0, section: newSectionFor('content') })
    const id = s0.layout.sections[0]!.id
    const s = layoutReducer(s0, { type: 'setData', id, data: { kind: 'faq', faq: { items: [] } } })
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

describe('setTheme', () => {
  const branding = buildPublicBranding({ business_name: 'Sam MC' })
  const themed = (): LayoutEditorState => ({ ...base(), layout: { ...base().layout, theme: defaultTheme(branding) } })

  it('patches the top level, one animation field, and one text role without touching the rest', () => {
    const start = themed()
    const next = layoutReducer(start, { type: 'setTheme', patch: { sectionGap: 32, animation: { speed: 'fast' }, text: { paragraph: { size: 20 } } } })
    expect(next.layout.theme?.sectionGap).toBe(32)
    expect(next.layout.theme?.animation).toEqual({ ...start.layout.theme!.animation, speed: 'fast' })
    expect(next.layout.theme?.text.paragraph).toEqual({ ...start.layout.theme!.text.paragraph, size: 20 })
    expect(next.layout.theme?.text.heading1).toBe(start.layout.theme!.text.heading1)
    expect(next.layout.sections).toBe(start.layout.sections)
  })

  it('a page-level width or padding change applies to every section: their own values for that field are cleared, other fields kept', () => {
    const start = themed()
    const id = start.layout.sections[0]!.id
    const withOverrides = layoutReducer(start, { type: 'updateStyle', id, patch: { padding: 38, paddingX: 8, contentWidth: 'wide' } })
    expect(withOverrides.layout.sections[0]!.style).toMatchObject({ padding: 38, paddingX: 8, contentWidth: 'wide' })

    const next = layoutReducer(withOverrides, { type: 'setTheme', patch: { sectionPadding: 'roomy' } })
    expect(next.layout.theme?.sectionPadding).toBe('roomy')
    expect(next.layout.sections[0]!.style.padding).toBeUndefined()
    expect(next.layout.sections[0]!.style).toMatchObject({ paddingX: 8, contentWidth: 'wide' })
    // Untouched sections keep their identity (no needless re-render / churn).
    expect(next.layout.sections[1]).toBe(withOverrides.layout.sections[1])

    const last = layoutReducer(next, { type: 'setTheme', patch: { sectionPaddingX: 16, contentWidth: 'narrow' } })
    expect(last.layout.sections[0]!.style.paddingX).toBeUndefined()
    expect(last.layout.sections[0]!.style.contentWidth).toBeUndefined()
  })

  it('is a no-op on a layout with no theme (the editor seeds one before any dispatch)', () => {
    const start = base()
    expect(layoutReducer(start, { type: 'setTheme', patch: { sectionGap: 32 } })).toBe(start)
  })

  it('applyThemePatch with a whole theme replaces every field (what "Reset to default" sends)', () => {
    const current = applyThemePatch(defaultTheme(branding), { background: '#000000', text: { heading1: { size: 99 } } })
    expect(applyThemePatch(current, defaultTheme(branding))).toEqual(defaultTheme(branding))
  })
})

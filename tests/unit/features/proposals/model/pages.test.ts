/**
 * `splitPages` (`model/pages.ts`): how a flat section list becomes the
 * pages step flow shows one screen at a time, keyed on `pageBreak`
 * sections.
 *
 * @module tests/unit/features/proposals/model/pages
 */
import { describe, expect, it } from 'vitest'

import { doc, paragraph, splitPages, text, type Section } from '@/features/proposals'

function content(id: string): Section {
  return { id, kind: 'content', style: { height: 'fit', contentWidth: 'medium' }, content: doc(paragraph(text(id))) }
}
function pageBreak(id: string): Section {
  return { id, kind: 'pageBreak', style: { height: 'fit', contentWidth: 'medium' } }
}

describe('splitPages', () => {
  it('a layout with no breaks is one page holding every section', () => {
    const pages = splitPages([content('a'), content('b')])
    expect(pages).toEqual([{ id: 'page-first', sections: [content('a'), content('b')] }])
  })

  it('every page break opens a new page keyed by the break itself', () => {
    const pages = splitPages([content('a'), pageBreak('pb1'), content('b'), content('c'), pageBreak('pb2'), content('d')])
    expect(pages.map((p) => p.id)).toEqual(['page-first', 'pb1', 'pb2'])
    expect(pages.map((p) => p.sections.map((s) => s.id))).toEqual([['a'], ['b', 'c'], ['d']])
    expect(pages[1]?.breakSection?.id).toBe('pb1')
    expect(pages[0]?.breakSection).toBeUndefined()
  })

  it('keeps empty pages (a leading, trailing or doubled break) so the editor can still show and delete the break', () => {
    const pages = splitPages([pageBreak('pb0'), content('a'), pageBreak('pb1'), pageBreak('pb2'), content('b'), pageBreak('pb3')])
    expect(pages.map((p) => [p.id, p.sections.length])).toEqual([['page-first', 0], ['pb0', 1], ['pb1', 0], ['pb2', 1], ['pb3', 0]])
  })

  it('an empty layout is one empty page', () => {
    expect(splitPages([])).toEqual([{ id: 'page-first', sections: [] }])
  })
})

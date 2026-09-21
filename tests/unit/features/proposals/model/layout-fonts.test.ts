/**
 * `layoutFontIds` tells the public proposal page which Google Fonts to
 * load: the four theme roles plus every per-run override a `textStyle`
 * mark carries. Anything it misses renders in the fallback face on the
 * couple's page, which for a script font is very visible.
 *
 * @module tests/unit/features/proposals/model/layout-fonts
 */
import { describe, expect, it } from 'vitest'

import {
  column, columns, defaultTheme, doc, heading, layoutFontIds, paragraph, text, type ProposalLayout, type ProposalTheme,
} from '@/features/proposals'
import { FONT_STACKS } from '@/lib/branding/fonts'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const branding = buildPublicBranding({ business_name: 'Sam MC', font_heading: 'playfair', font_body: 'inter' })

function themed(overrides: Partial<Record<keyof ProposalTheme['text'], string>> = {}): ProposalTheme {
  const theme = defaultTheme(branding)
  for (const [role, font] of Object.entries(overrides)) {
    theme.text[role as keyof ProposalTheme['text']] = { ...theme.text[role as keyof ProposalTheme['text']], font: font as never }
  }
  return theme
}

const section = (content: ReturnType<typeof doc>, id = 'sec'): ProposalLayout['sections'][number] =>
  ({ id, kind: 'content', style: { height: 'fit', contentWidth: 'medium' }, content })

describe('layoutFontIds', () => {
  it('collects the theme roles for a themed layout', () => {
    const layout: ProposalLayout = { version: 2, theme: themed({ heading1: 'great_vibes' }), sections: [section(doc(paragraph(text('hi'))))] }
    const ids = layoutFontIds(layout, branding)
    expect(ids).toContain('great_vibes')
    expect(ids).toContain('playfair')
    expect(ids).toContain('inter')
  })

  it('falls back to the Branding-seeded theme for a pre-theme layout', () => {
    const layout: ProposalLayout = { version: 2, sections: [section(doc(paragraph(text('hi'))))] }
    expect(layoutFontIds(layout, branding)).toEqual(expect.arrayContaining(['playfair', 'inter']))
  })

  it('includes a per-run textStyle font, however deeply nested', () => {
    const run = text('Vows', [{ type: 'textStyle', attrs: { fontFamily: FONT_STACKS.parisienne } }])
    const layout: ProposalLayout = {
      version: 2, theme: themed(),
      sections: [
        section(doc(heading(2, text('Plain'))), 'a'),
        section(doc(columns(column(1, paragraph(text('x'))), column(1, paragraph(run)))), 'b'),
      ],
    }
    expect(layoutFontIds(layout, branding)).toContain('parisienne')
  })

  it('ignores unknown stacks and never repeats an id', () => {
    const odd = text('?', [{ type: 'textStyle', attrs: { fontFamily: 'Comic Sans MS, cursive' } }])
    const dup = text('!', [{ type: 'textStyle', attrs: { fontFamily: FONT_STACKS.playfair } }])
    const layout: ProposalLayout = { version: 2, theme: themed(), sections: [section(doc(paragraph(odd, dup)))] }
    const ids = layoutFontIds(layout, branding)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => id in FONT_STACKS)).toBe(true)
  })

  it('skips data sections, which carry no rich text', () => {
    const layout: ProposalLayout = {
      version: 2, theme: themed(),
      sections: [{ id: 'p', kind: 'packages', style: { height: 'fit', contentWidth: 'medium' }, data: { kind: 'packages', options: [] } } as never],
    }
    expect(() => layoutFontIds(layout, branding)).not.toThrow()
  })
})

/**
 * The canvas theme (`features/proposals/model/theme.ts`): seeding from
 * Branding must reproduce exactly what `roleDefaults` gave the renderer
 * before themes existed (so an untouched template does not change), except
 * the paragraph colour, which starts black on purpose; `withTheme` seeds a
 * pre-theme layout and frees its untouched content padding; the schema
 * accepts a seeded theme and refuses a malformed one.
 */
import { describe, expect, it } from 'vitest'

import {
  blankTemplateLayout, CONTENT_TEXT_COLOR, defaultTheme, effectivePadding, parseProposalLayout, resolveTheme, roleCss,
  effectiveWidth, inheritMatchingDefaults, newSectionFor, SECTION_PADDING_X_PX, themeRoleCss, withTheme, type ProposalLayout,
} from '@/features/proposals'
import { fluidFontSize } from '@/lib/branding/fluid-type'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import { roleDefaults } from '@/lib/branding/type-defaults'

const branding = buildPublicBranding({ business_name: 'Sam MC', heading_size: 40, body_size: 17, font_heading: 'playfair' })

describe('defaultTheme', () => {
  it('seeds every heading role from roleDefaults, so an untouched template renders as before', () => {
    const theme = defaultTheme(branding)
    for (const [role, brand] of [['heading1', 'docTitle'], ['heading2', 'sectionHeading'], ['heading3', 'subtitle']] as const) {
      const d = roleDefaults(branding, brand)
      expect(theme.text[role]).toEqual({
        font: d.fontFamily, size: d.fontSize, weight: d.fontWeight, color: d.color,
        case: d.textTransform ?? 'none', letterSpacing: d.letterSpacing, lineHeight: d.lineHeight, align: 'left',
      })
    }
  })

  it('seeds the paragraph from the body role but starts its colour black', () => {
    const theme = defaultTheme(branding)
    const d = roleDefaults(branding, 'body')
    expect(theme.text.paragraph.size).toBe(d.fontSize)
    expect(theme.text.paragraph.font).toBe(d.fontFamily)
    expect(theme.text.paragraph.color).toBe(CONTENT_TEXT_COLOR)
    expect(branding.text_color).not.toBe(CONTENT_TEXT_COLOR)
  })

  it("matches the pre-theme page's fixed behaviour: page background, no gap, cozy, stacked, slide by section at medium", () => {
    expect(defaultTheme(branding)).toMatchObject({
      background: branding.page_background, sectionGap: 0, sectionPadding: 'cozy', flow: 'stack',
      animation: { mode: 'section', type: 'slide', speed: 'medium' },
    })
  })

  it('validates against the layout schema', () => {
    const layout: ProposalLayout = { ...blankTemplateLayout(), theme: defaultTheme(branding) }
    expect(parseProposalLayout(layout)).toMatchObject({ ok: true })
  })
})

describe('themeRoleCss / roleCss', () => {
  it('roleCss with a theme produces the theme role (heading sizes independent of the brand scale)', () => {
    const theme = defaultTheme(branding)
    theme.text.heading2.size = 77
    // 77px is past the fluid floor, so it arrives as a clamp with 77px as its ceiling (`model/fluid-type.ts`).
    expect(roleCss(branding, 'sectionHeading', { theme }).fontSize).toBe('clamp(46px, 13.75cqw, 77px)')
    expect(roleCss(branding, 'sectionHeading', { theme })).toEqual(themeRoleCss(theme, 'heading2'))
  })

  it('roleCss without a theme, and for a non-theme role, still resolves from Branding', () => {
    expect(roleCss(branding, 'sectionHeading').fontSize).toBe(fluidFontSize(roleDefaults(branding, 'sectionHeading').fontSize))
    expect(roleCss(branding, 'finePrint', { theme: defaultTheme(branding) }).fontSize).toBe(fluidFontSize(roleDefaults(branding, 'finePrint').fontSize))
  })

  it('a role sized past the fluid floor gets a clamp (any role, not just Heading 1), inheritColor drops the colour, alignment comes through', () => {
    const theme = defaultTheme(branding)
    theme.text.heading1.align = 'center'
    theme.text.heading1.size = 56
    theme.text.heading3.size = 40
    const css = themeRoleCss(theme, 'heading1', { inheritColor: true })
    expect(css.fontSize).toBe('clamp(34px, 10cqw, 56px)')
    expect(css.color).toBeUndefined()
    expect(css.textAlign).toBe('center')
    expect(themeRoleCss(theme, 'heading3').fontSize).toBe('clamp(32px, 7.14cqw, 40px)')
    // A title on the floor itself (Branding's default 32px) still gets the
    // gentle body-range clamp (2026-09-19: body-range sizes shrink a
    // little too, not just past-floor headlines).
    theme.text.heading1.size = 32
    expect(themeRoleCss(theme, 'heading1').fontSize).toBe('clamp(27px, 5.71cqw, 32px)')
  })
})

describe('resolveTheme / withTheme / effectivePadding', () => {
  it('resolveTheme returns the layout theme when set, else the seeded default', () => {
    const theme = { ...defaultTheme(branding), sectionGap: 64 }
    expect(resolveTheme({ theme }, branding)).toBe(theme)
    expect(resolveTheme({}, branding)).toEqual(defaultTheme(branding))
  })

  it('withTheme seeds a pre-theme layout and drops untouched cozy padding from content sections only', () => {
    const layout = blankTemplateLayout()
    const cozyContent = { ...layout.sections[0]!, id: 'a', style: { ...layout.sections[0]!.style, padding: 'cozy' as const } }
    const roomyContent = { ...cozyContent, id: 'b', style: { ...cozyContent.style, padding: 'roomy' as const } }
    const result = withTheme({ ...layout, sections: [cozyContent, roomyContent] }, branding)
    expect(result.theme).toEqual(defaultTheme(branding))
    expect(result.sections[0]?.style.padding).toBeUndefined()
    expect(result.sections[1]?.style.padding).toBe('roomy')
  })

  it('withTheme leaves an already-themed layout untouched (same reference)', () => {
    const layout: ProposalLayout = { ...blankTemplateLayout(), theme: defaultTheme(branding) }
    expect(withTheme(layout, branding)).toBe(layout)
  })

  it('withTheme releases any section value that matches the page default, data sections included, and keeps real overrides', () => {
    const theme = defaultTheme(branding)
    const base = blankTemplateLayout()
    const cozyData = { ...newSectionFor('faq'), id: 'faq', style: { ...newSectionFor('faq').style, padding: 'cozy' as const, paddingX: 32 } }
    const roomyContent = { ...base.sections[0]!, id: 'c', style: { ...base.sections[0]!.style, padding: 'roomy' as const, contentWidth: 'medium' as const } }
    const dragged = { ...roomyContent, id: 'd', style: { height: 'fit' as const, padding: 38 } }
    const result = withTheme({ ...base, theme, sections: [cozyData, roomyContent, dragged] }, branding)
    expect(result.sections[0]?.style.padding).toBeUndefined()
    expect(result.sections[0]?.style.paddingX).toBeUndefined()
    expect(result.sections[1]?.style.padding).toBe('roomy')
    expect(result.sections[1]?.style.contentWidth).toBeUndefined()
    expect(result.sections[2]?.style.padding).toBe(38)
  })

  it('inheritMatchingDefaults returns the same style object when nothing matches', () => {
    const theme = defaultTheme(branding)
    const style = { height: 'fit' as const, padding: 'roomy' as const, contentWidth: 'wide' as const }
    expect(inheritMatchingDefaults(style, theme)).toBe(style)
  })

  it('withTheme gives a theme saved before Page width existed the default, and frees content sections still on the old fixed medium', () => {
    const base = blankTemplateLayout()
    const medium = { ...base.sections[0]!, id: 'a', style: { ...base.sections[0]!.style, contentWidth: 'medium' as const } }
    const wide = { ...medium, id: 'b', style: { ...medium.style, contentWidth: 'wide' as const } }
    const legacyTheme = { ...defaultTheme(branding) } as Partial<ReturnType<typeof defaultTheme>>
    delete legacyTheme.contentWidth
    const result = withTheme({ ...base, sections: [medium, wide], theme: legacyTheme as ReturnType<typeof defaultTheme> }, branding)
    expect(result.theme?.contentWidth).toBe('medium')
    expect(result.sections[0]?.style.contentWidth).toBeUndefined()
    expect(result.sections[1]?.style.contentWidth).toBe('wide')
    // Same theme without the field, through the schema: still parses, and resolves to medium on the page.
    const parsed = parseProposalLayout({ version: 2, sections: [], theme: legacyTheme })
    expect(parsed.ok).toBe(true)
    expect(parsed.ok && resolveTheme(parsed.layout, branding).contentWidth).toBe('medium')
  })

  it('effectiveWidth falls back to the theme default', () => {
    const theme = { ...defaultTheme(branding), contentWidth: 'wide' as const }
    expect(effectiveWidth(undefined, theme)).toBe('wide')
    expect(effectiveWidth('narrow', theme)).toBe('narrow')
    expect(effectiveWidth(900, theme)).toBe(900)
  })

  it('effectivePadding falls back to the theme default', () => {
    const theme = { ...defaultTheme(branding), sectionPadding: 'roomy' as const }
    expect(effectivePadding(undefined, theme)).toBe('roomy')
    expect(effectivePadding(12, theme)).toBe(12)
  })
})

describe('theme schema', () => {
  it('accepts a layout without a theme and a section without padding', () => {
    const layout = blankTemplateLayout()
    expect(layout.theme).toBeUndefined()
    expect(layout.sections[0]?.style.padding).toBeUndefined()
    expect(parseProposalLayout(layout).ok).toBe(true)
  })

  it('refuses a theme with a bad colour, an unknown font, or a missing role', () => {
    const good = defaultTheme(branding)
    const layout = blankTemplateLayout()
    const bad1 = { ...layout, theme: { ...good, background: 'red' } }
    const bad2 = { ...layout, theme: { ...good, text: { ...good.text, paragraph: { ...good.text.paragraph, font: 'comic' } } } }
    const missing: Partial<typeof good.text> = { ...good.text }
    delete missing.heading3
    const bad3 = { ...layout, theme: { ...good, text: missing } }
    for (const bad of [bad1, bad2, bad3]) expect(parseProposalLayout(bad).ok).toBe(false)
  })
})

describe('sectionPaddingX', () => {
  it('defaults to the cozy stop and is filled in by the schema for a theme saved before it existed', () => {
    const theme = defaultTheme(branding)
    expect(theme.sectionPaddingX).toBe(SECTION_PADDING_X_PX.cozy)
    const legacy: Partial<typeof theme> = { ...theme }
    delete legacy.sectionPaddingX
    const parsed = parseProposalLayout({ version: 2, sections: [], theme: legacy })
    expect(parsed.ok && parsed.layout.theme?.sectionPaddingX).toBe(SECTION_PADDING_X_PX.cozy)
  })
})

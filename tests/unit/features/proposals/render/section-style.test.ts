/**
 * Section style → CSS (spec §6): named widths and paddings map to the
 * tokens / px stops, numbers pass through, `full` height is one screen
 * on the page and a fixed opening in print.
 *
 * @module tests/unit/features/proposals/render/section-style
 */
import { describe, expect, it } from 'vitest'

import { defaultTheme, sectionCss, type SectionStyle } from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const theme = defaultTheme(buildPublicBranding({ business_name: 'Sam MC' }))
const base: SectionStyle = { height: 'fit', contentWidth: 'medium', padding: 'cozy' }

describe('sectionCss', () => {
  it('a section with no width of its own takes the theme\'s Page width', () => {
    const inherits: SectionStyle = { height: base.height, padding: base.padding }
    expect(sectionCss(inherits, 'page', { ...theme, contentWidth: 'wide' }).columnClass).toBe('max-w-doc-page')
    expect(sectionCss(inherits, 'page', { ...theme, contentWidth: 900 }).column.maxWidth).toBe(900)
  })
  it('maps named widths to the doc tokens and numbers to px', () => {
    expect(sectionCss(base, 'page', theme).columnClass).toContain('max-w-doc-prose')
    expect(sectionCss({ ...base, contentWidth: 'narrow' }, 'page', theme).columnClass).toContain('max-w-doc-narrow')
    expect(sectionCss({ ...base, contentWidth: 'wide' }, 'page', theme).columnClass).toContain('max-w-doc-page')
    expect(sectionCss({ ...base, contentWidth: 900 }, 'page', theme).column.maxWidth).toBe(900)
  })
  it('maps padding stops to px and numbers through', () => {
    expect(sectionCss(base, 'page', theme).column.paddingTop).toBe(48)
    expect(sectionCss({ ...base, padding: 100 }, 'page', theme).column.paddingBottom).toBe(100)
  })
  it('the horizontal padding is the theme\'s, capped on a narrow container so a wide desktop inset never eats a phone', () => {
    expect(sectionCss(base, 'page', theme).column.paddingInline).toBe('min(32px, 10cqw)')
    expect(sectionCss(base, 'page', { ...theme, sectionPaddingX: 96 }).column.paddingInline).toBe('min(96px, 10cqw)')
    // A section's own paddingX beats the theme's, as its own vertical padding does.
    expect(sectionCss({ ...base, paddingX: 8 }, 'page', { ...theme, sectionPaddingX: 96 }).column.paddingInline).toBe('min(8px, 10cqw)')
  })
  it('full height is one screen on the page and 480px in print', () => {
    expect(sectionCss({ ...base, height: 'full' }, 'page', theme).section.minHeight).toBe('100svh')
    expect(sectionCss({ ...base, height: 'full' }, 'print', theme).section.minHeight).toBe(480)
    expect(sectionCss(base, 'page', theme).section.minHeight).toBeUndefined()
  })
  it('aligns the content column to the section alignment, and leaves it unset otherwise', () => {
    // The Style popover's Alignment pill wrote `style.align` that nothing
    // on a data section ever read (live bug, 2026-09-19): the column is the
    // one element every kind shares, so it carries the alignment.
    expect(sectionCss({ ...base, align: 'center' }, 'page', theme).column.textAlign).toBe('center')
    expect(sectionCss({ ...base, align: 'right' }, 'edit', theme).column.textAlign).toBe('right')
    expect(sectionCss(base, 'page', theme).column.textAlign).toBeUndefined()
  })
  it('publishes the alignment as a box margin for a fixed-width block (a resized video) to sit left/centre/right', () => {
    const margin = (align: SectionStyle['align']) => (sectionCss({ ...base, ...(align ? { align } : {}) }, 'page', theme).column as Record<string, unknown>)['--doc-box-margin']
    // `margin-inline: <start> <end>` values.
    expect(margin('left')).toBe('0 auto')
    expect(margin('center')).toBe('auto')
    expect(margin('right')).toBe('auto 0')
    expect(margin(undefined)).toBeUndefined()
  })
  it('publishes `--doc-align` (a block that centres by default, like accept, reads it with its own fallback) and `--doc-box-justify` for card grids', () => {
    const vars = (align: SectionStyle['align']) => sectionCss({ ...base, ...(align ? { align } : {}) }, 'page', theme).column as Record<string, unknown>
    expect(vars('right')['--doc-align']).toBe('right')
    expect(vars('left')['--doc-box-justify']).toBe('start')
    expect(vars('center')['--doc-box-justify']).toBe('center')
    expect(vars('right')['--doc-box-justify']).toBe('end')
    expect(vars(undefined)['--doc-align']).toBeUndefined()
    expect(vars(undefined)['--doc-box-justify']).toBeUndefined()
  })
  it('paints the background colour and text colour on the section', () => {
    const css = sectionCss({ ...base, background: { color: '#112233' }, textColor: '#FFFFFF' }, 'page', theme)
    expect(css.section.background).toBe('#112233')
    expect(css.section.color).toBe('#FFFFFF')
  })
  it('maps vertical alignment to the content column justify class, defaulting to middle', () => {
    expect(sectionCss({ ...base, verticalAlign: 'top' }, 'page', theme).justifyClass).toBe('justify-start')
    expect(sectionCss({ ...base, verticalAlign: 'middle' }, 'page', theme).justifyClass).toBe('justify-center')
    expect(sectionCss({ ...base, verticalAlign: 'bottom' }, 'page', theme).justifyClass).toBe('justify-end')
    expect(sectionCss(base, 'page', theme).justifyClass).toBe('justify-center')
  })
})

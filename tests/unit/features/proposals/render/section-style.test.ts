/**
 * Section style → CSS (spec §6): named widths and paddings map to the
 * tokens / px stops, numbers pass through, `full` height is one screen
 * on the page and a fixed opening in print.
 *
 * @module tests/unit/features/proposals/render/section-style
 */
import { describe, expect, it } from 'vitest'

import { sectionCss, type SectionStyle } from '@/features/proposals'

const base: SectionStyle = { height: 'fit', contentWidth: 'medium', padding: 'cozy' }

describe('sectionCss', () => {
  it('maps named widths to the doc tokens and numbers to px', () => {
    expect(sectionCss(base, 'page').columnClass).toContain('max-w-doc-prose')
    expect(sectionCss({ ...base, contentWidth: 'narrow' }, 'page').columnClass).toContain('max-w-doc-narrow')
    expect(sectionCss({ ...base, contentWidth: 'wide' }, 'page').columnClass).toContain('max-w-doc-page')
    expect(sectionCss({ ...base, contentWidth: 900 }, 'page').column.maxWidth).toBe(900)
  })
  it('maps padding stops to px and numbers through', () => {
    expect(sectionCss(base, 'page').column.paddingTop).toBe(48)
    expect(sectionCss({ ...base, padding: 100 }, 'page').column.paddingBottom).toBe(100)
  })
  it('full height is one screen on the page and 480px in print', () => {
    expect(sectionCss({ ...base, height: 'full' }, 'page').section.minHeight).toBe('100svh')
    expect(sectionCss({ ...base, height: 'full' }, 'print').section.minHeight).toBe(480)
    expect(sectionCss(base, 'page').section.minHeight).toBeUndefined()
  })
  it('paints the background colour and text colour on the section', () => {
    const css = sectionCss({ ...base, background: { color: '#112233' }, textColor: '#FFFFFF' }, 'page')
    expect(css.section.background).toBe('#112233')
    expect(css.section.color).toBe('#FFFFFF')
  })
})

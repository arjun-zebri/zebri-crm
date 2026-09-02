import { describe, expect, it } from 'vitest'

import {
  CJK_FALLBACK_FAMILIES,
  collectScriptFonts,
  DEFAULT_SCRIPT_FONT,
  isScriptFontId,
  SCRIPT_FONT_FAMILIES,
  SCRIPT_FONT_IDS,
  scriptFontIdFromFamily,
  scriptFontsHref,
  scriptFontStack,
} from '@/lib/documents/script-fonts'

describe('script fonts', () => {
  it('every stack ends with the CJK fallbacks then a generic family', () => {
    for (const id of SCRIPT_FONT_IDS) {
      const stack = scriptFontStack(id)
      for (const f of CJK_FALLBACK_FAMILIES) expect(stack).toContain(`"${f}"`)
      expect(stack).toMatch(/, (serif|sans-serif)$/)
      expect(stack.startsWith(SCRIPT_FONT_FAMILIES[id])).toBe(true)
    }
  })

  it('defaults to Noto Serif, a coverage face', () => {
    expect(DEFAULT_SCRIPT_FONT).toBe('noto_serif')
    expect(scriptFontStack('noto_serif')).toMatch(/^"Noto Serif"/)
    expect(scriptFontStack('noto_serif')).toMatch(/serif$/)
    expect(scriptFontStack('noto_sans')).toMatch(/sans-serif$/)
  })

  it('the Google Fonts href loads the requested faces plus all four CJK families, once each', () => {
    const href = scriptFontsHref(['noto_serif', 'lora', 'noto_serif'])
    expect(href.startsWith('https://fonts.googleapis.com/css2?')).toBe(true)
    expect(href.match(/Noto\+Serif:/g)).toHaveLength(1)
    expect(href).toContain('family=Lora:')
    for (const f of ['Noto+Sans+SC', 'Noto+Sans+TC', 'Noto+Sans+JP', 'Noto+Sans+KR']) expect(href).toContain(`family=${f}`)
    expect(href).toContain('display=swap')
  })

  it('maps a font-family mark back to its id, ignoring quotes and fallbacks', () => {
    expect(scriptFontIdFromFamily('"Lora"')).toBe('lora')
    expect(scriptFontIdFromFamily("'Noto Sans', sans-serif")).toBe('noto_sans')
    expect(scriptFontIdFromFamily('Comic Sans MS')).toBeNull()
    expect(scriptFontIdFromFamily(undefined)).toBeNull()
  })

  it('collects the base face plus every face used by a mark', () => {
    const content = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'a', marks: [{ type: 'textStyle', attrs: { fontFamily: '"Lora"' } }] }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'b', marks: [{ type: 'textStyle', attrs: { fontFamily: '"Inter"' } }] }] }] }] },
      ],
    }
    expect(collectScriptFonts(content, 'noto_serif').sort()).toEqual(['inter', 'lora', 'noto_serif'])
    expect(collectScriptFonts(null, 'noto_sans')).toEqual(['noto_sans'])
  })

  it('recognises catalogue ids only', () => {
    expect(isScriptFontId('noto_serif')).toBe(true)
    expect(isScriptFontId('playfair')).toBe(true)
    expect(isScriptFontId('wingdings')).toBe(false)
  })
})

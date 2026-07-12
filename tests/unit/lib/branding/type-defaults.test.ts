import { describe, expect, it } from 'vitest'

import { buildPublicBranding } from '@/lib/branding/public-branding'
import { resolveTypeDefaults } from '@/lib/branding/type-defaults'

describe('resolveTypeDefaults', () => {
  it('resolves heading defaults from PublicBranding', () => {
    const b = buildPublicBranding({})
    const td = resolveTypeDefaults(b)
    expect(td.heading).toBeDefined()
    expect(td.heading.font).toBe(b.font_heading)
    expect(td.heading.sizePx).toBe(b.heading_size)
    expect(td.heading.weight).toBe(b.font_weight)
    expect(td.heading.color).toBe(b.text_color)
    expect(td.heading.textTransform).toBe('none')
    expect(td.heading.letterSpacing).toBe(b.heading_letter_spacing)
    expect(td.heading.align).toBe('left')
  })

  it('resolves body defaults from PublicBranding', () => {
    const b = buildPublicBranding({})
    const td = resolveTypeDefaults(b)
    expect(td.body).toBeDefined()
    expect(td.body.font).toBe(b.font_body)
    expect(td.body.sizePx).toBe(b.body_size)
    expect(td.body.weight).toBe(b.font_body_weight)
    expect(td.body.color).toBe(b.text_color)
    expect(td.body.textTransform).toBe('none')
    expect(td.body.letterSpacing).toBe(0)
    expect(td.body.lineHeight).toBe(b.body_line_height)
    expect(td.body.align).toBe('left')
  })

  it('applies heading_case override to heading.textTransform', () => {
    const b = buildPublicBranding({ heading_case: 'uppercase' })
    const td = resolveTypeDefaults(b)
    expect(td.heading.textTransform).toBe('uppercase')
  })

  it('applies body_case override to body.textTransform', () => {
    const b = buildPublicBranding({ body_case: 'capitalize' })
    const td = resolveTypeDefaults(b)
    expect(td.body.textTransform).toBe('capitalize')
  })

  it('applies heading_letter_spacing to heading', () => {
    const b = buildPublicBranding({ heading_letter_spacing: 2 })
    const td = resolveTypeDefaults(b)
    expect(td.heading.letterSpacing).toBe(2)
  })

  it('applies body_line_height to body', () => {
    const b = buildPublicBranding({ body_line_height: 1.8 })
    const td = resolveTypeDefaults(b)
    expect(td.body.lineHeight).toBe(1.8)
  })

  it('applies heading_size and body_size overrides', () => {
    const b = buildPublicBranding({ heading_size: 44, body_size: 16 })
    const td = resolveTypeDefaults(b)
    expect(td.heading.sizePx).toBe(44)
    expect(td.body.sizePx).toBe(16)
  })

  it('respects all font settings from metadata', () => {
    const b = buildPublicBranding({
      font_heading: 'playfair',
      font_body: 'lora',
      font_weight: 600,
      font_body_weight: 500,
      text_color: '#FF0000',
    })
    const td = resolveTypeDefaults(b)
    expect(td.heading.font).toBe('playfair')
    expect(td.heading.weight).toBe(600)
    expect(td.body.font).toBe('lora')
    expect(td.body.weight).toBe(500)
    expect(td.heading.color).toBe('#FF0000')
    expect(td.body.color).toBe('#FF0000')
  })
})

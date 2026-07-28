import { describe, expect, it } from 'vitest'

import { buildPublicBranding } from '@/lib/branding/public-branding'
import { resolveTypeDefaults, roleDefaults } from '@/lib/branding/type-defaults'

describe('resolveTypeDefaults', () => {
  it('resolves heading defaults from PublicBranding', () => {
    const b = buildPublicBranding({})
    const td = resolveTypeDefaults(b)
    expect(td.heading).toBeDefined()
    expect(td.heading.font).toBe(b.font_heading)
    expect(td.heading.sizePx).toBe(b.heading_size)
    expect(td.heading.weight).toBe(b.font_weight)
    expect(td.heading.color).toBe(b.heading_color)
    expect(td.heading.textTransform).toBe('none')
    expect(td.heading.letterSpacing).toBe(b.heading_letter_spacing)
    expect(td.heading.align).toBe('left')
  })

  it('heading role uses heading_color, body uses text_color', () => {
    const b = buildPublicBranding({ heading_color: '#000000', text_color: '#777777' })
    const t = resolveTypeDefaults(b)
    expect(t.heading.color).toBe('#000000')
    expect(t.body.color).toBe('#777777')
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
      heading_color: '#FF00FF',
      text_color: '#FF0000',
    })
    const td = resolveTypeDefaults(b)
    expect(td.heading.font).toBe('playfair')
    expect(td.heading.weight).toBe(600)
    expect(td.body.font).toBe('lora')
    expect(td.body.weight).toBe(500)
    expect(td.heading.color).toBe('#FF00FF')
    expect(td.body.color).toBe('#FF0000')
  })
})

describe('roleDefaults', () => {
  const b = buildPublicBranding({
    heading_size: 32,
    body_size: 15,
    heading_color: '#111827',
    subheading_color: '#7828C8',
    text_color: '#333333',
  })

  it('maps heading roles to the heading colour and heading font', () => {
    const d = roleDefaults(b, 'docTitle')
    expect(d.fontSize).toBe(32)
    expect(d.color).toBe('#111827')
    expect(d.fontFamily).toBe(b.font_heading)
  })

  it('maps label and subtitle roles to the subheading colour', () => {
    expect(roleDefaults(b, 'sectionLabel').color).toBe('#7828C8')
    expect(roleDefaults(b, 'subtitle').color).toBe('#7828C8')
  })

  it('maps body roles to the body colour and body font', () => {
    const d = roleDefaults(b, 'body')
    expect(d.color).toBe('#333333')
    expect(d.fontFamily).toBe(b.font_body)
  })

  it('sectionLabel follows global heading case and letter spacing', () => {
    const d = roleDefaults(b, 'sectionLabel')
    expect(d.textTransform).toBe('none')
    expect(d.letterSpacing).toBe(0)
  })

  it('sectionLabel applies heading_case override', () => {
    const d = roleDefaults(
      buildPublicBranding({
        heading_case: 'uppercase',
        heading_size: 32,
        body_size: 15,
        heading_color: '#111827',
        subheading_color: '#7828C8',
        text_color: '#333333',
      }),
      'sectionLabel'
    )
    expect(d.textTransform).toBe('uppercase')
  })

  it('sectionLabel applies heading_letter_spacing override', () => {
    const d = roleDefaults(
      buildPublicBranding({
        heading_letter_spacing: 0.2,
        heading_size: 32,
        body_size: 15,
        heading_color: '#111827',
        subheading_color: '#7828C8',
        text_color: '#333333',
      }),
      'sectionLabel'
    )
    expect(d.letterSpacing).toBe(0.2)
  })

  it('propagates a heading size change to every heading role', () => {
    const big = buildPublicBranding({ heading_size: 40, body_size: 15, heading_color: '#111827', subheading_color: '#7828C8', text_color: '#333333' })
    expect(roleDefaults(big, 'docTitle').fontSize).toBe(40)
    expect(roleDefaults(big, 'sectionHeading').fontSize).toBe(25)
  })
})

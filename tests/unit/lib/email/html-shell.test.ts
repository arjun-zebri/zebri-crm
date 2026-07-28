/**
 * Branded email shell tests (`wrapTemplateHtml`).
 *
 * The same function feeds the editor's WYSIWYG preview iframe and the
 * real send, so these assertions are the "preview equals send"
 * guarantee: branding renders when supplied, degrades to the neutral
 * Zebri shell when absent, and hostile metadata (script-ish colours,
 * non-http logo URLs, markup in names) can't reach the HTML.
 */
import { describe, expect, it } from 'vitest'

import { buildPublicBranding } from '@/lib/branding/public-branding'
import { wrapTemplateHtml } from '@/lib/email/html'

const BODY = '<p>Hello there</p>'

describe('wrapTemplateHtml', () => {
  it('renders the neutral shell when no branding is given', () => {
    const html = wrapTemplateHtml(BODY, 'Acme MC Co')
    expect(html).toContain('Hello there')
    expect(html).toContain('Sent by Acme MC Co via Zebri')
    expect(html).not.toContain('fonts.googleapis.com')
    expect(html).not.toContain('<img')
    // Default card radius preserved from the pre-branding shell.
    expect(html).toContain('border-radius:12px')
  })

  it('escapes markup in the business name', () => {
    const html = wrapTemplateHtml(BODY, '<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('applies full branding: colours, fonts, logo, radius', () => {
    const branding = buildPublicBranding({
      brand_color: '#AA1122',
      logo_url: 'https://cdn.example.com/logo.png',
      font_heading: 'playfair',
      font_body: 'lora',
      corner_radius: 20,
      business_name: 'Acme MC Co',
    })
    const html = wrapTemplateHtml(BODY, 'Acme MC Co', branding)
    expect(html).toContain('#AA1122') // accent bar + links
    expect(html).toContain('https://cdn.example.com/logo.png')
    expect(html).toContain('fonts.googleapis.com')
    expect(html).toContain('Playfair Display')
    // Single-quoted in markup — a double quote would terminate the
    // style attribute (see the dedicated regression test below).
    expect(html).toContain("'Lora'")
    expect(html).toContain('border-radius:20px')
  })

  it('falls back to the business name wordmark when there is no logo', () => {
    const branding = buildPublicBranding({ business_name: 'Acme MC Co' })
    const html = wrapTemplateHtml(BODY, 'Acme MC Co', branding)
    expect(html).not.toContain('<img')
    // Wordmark header + footer both carry the name.
    expect(html.split('Acme MC Co').length).toBeGreaterThan(2)
  })

  it('rejects a non-hex brand colour and a non-http logo URL', () => {
    const branding = buildPublicBranding({
      brand_color: 'red;background:url(javascript:x)',
      logo_url: 'javascript:alert(1)',
    })
    // buildPublicBranding passes strings through, so the shell itself
    // must be the gate.
    branding.brand_color = 'red;background:url(javascript:x)'
    branding.logo_url = 'javascript:alert(1)'
    const html = wrapTemplateHtml(BODY, 'Acme', branding)
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('url(')
  })

  it('clamps a corrupted corner radius', () => {
    const branding = buildPublicBranding({ corner_radius: 9999 })
    const html = wrapTemplateHtml(BODY, 'Acme', branding)
    expect(html).toContain('border-radius:32px')
  })

  it('honours the email appearance switches (logo off, accent off)', () => {
    const branding = buildPublicBranding({
      logo_url: 'https://cdn.example.com/logo.png',
      brand_color: '#AA1122',
      email_shell_show_logo: false,
      email_shell_show_accent: false,
    })
    const html = wrapTemplateHtml(BODY, 'Acme', branding)
    expect(html).not.toContain('<img')
    expect(html).not.toContain('height:4px')
  })

  it('never leaks a double quote into a style attribute (Gmail drops broken styles)', () => {
    // Every font stack must interpolate attribute-safe: a raw `"` inside
    // style="…" terminates the attribute, and Gmail then strips the whole
    // style — which shipped as "the email has no padding".
    const branding = buildPublicBranding({ font_heading: 'playfair', font_body: 'lora' })
    const html = wrapTemplateHtml(BODY, 'Acme', branding)
    for (const match of html.matchAll(/style="([^"]*)"/g)) {
      expect(match[1]).not.toContain('font-family:$')
    }
    // No style attribute may end mid-declaration (the signature of a
    // quote-terminated attribute).
    expect(html).not.toMatch(/style="[^"]*font-family:"/)
    // And the fonts must still be present, single-quoted.
    expect(html).toContain("'Playfair Display'")
    expect(html).toContain("'Lora'")
  })

  it('centres the logo when the alignment pref says so', () => {
    const branding = buildPublicBranding({
      logo_url: 'https://cdn.example.com/logo.png',
      email_shell_logo_align: 'center',
    })
    const html = wrapTemplateHtml(BODY, 'Acme', branding)
    expect(html).toContain('align="center"')
    expect(html).toContain('margin:0 auto;')
  })
})

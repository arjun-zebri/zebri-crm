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

/**
 * Sender-identification footer (Task 13).
 *
 * The Spam Act requires a commercial electronic message to identify who
 * sent it and how to reach them. These assertions cover the three parts
 * this task owns: the identification line (ABN, phone, postal address),
 * graceful degradation when the MC has not filled those fields in yet,
 * and the unsubscribe link rendering only when a caller supplies one.
 */
describe('wrapTemplateHtml sender-identification footer', () => {
  it('renders ABN, phone and postal address when branding has them', () => {
    const branding = buildPublicBranding({
      business_name: 'Acme MC Co',
      abn: '12 345 678 901',
      phone: '+61 2 9000 0000',
      postal_address: '12 Smith St, Sydney NSW 2000',
    })
    const html = wrapTemplateHtml(BODY, 'Acme MC Co', branding)
    expect(html).toContain('ABN 12 345 678 901')
    expect(html).toContain('+61 2 9000 0000')
    expect(html).toContain('12 Smith St, Sydney NSW 2000')
  })

  // A legally required field left blank is worse than an obviously
  // incomplete footer, and blocking the send entirely would break every
  // existing user the moment this ships. So an MC who has not filled in
  // ABN/phone/postal address yet still sends mail: each blank field is
  // simply left out of the footer rather than shown empty or rendered as
  // a placeholder, and the send is never blocked on it.
  it('omits blank identification fields instead of blocking the send or showing them empty', () => {
    const branding = buildPublicBranding({ business_name: 'Acme MC Co' })
    const html = wrapTemplateHtml(BODY, 'Acme MC Co', branding)
    expect(html).toContain('Sent by Acme MC Co via Zebri')
    expect(html).not.toContain('ABN')
    expect(html).not.toMatch(/<p[^>]*>\s*<\/p>/)
  })

  it('renders nothing extra when there is no branding at all', () => {
    const html = wrapTemplateHtml(BODY, 'Acme MC Co')
    expect(html).toContain('Sent by Acme MC Co via Zebri')
    expect(html).not.toContain('ABN')
    expect(html).not.toContain('Unsubscribe')
  })

  it('renders the unsubscribe link only when the caller supplies one', () => {
    const withLink = wrapTemplateHtml(BODY, 'Acme MC Co', null, 'https://app.zebri.com.au/unsubscribe/abc.def')
    expect(withLink).toContain('Unsubscribe')
    expect(withLink).toContain('https://app.zebri.com.au/unsubscribe/abc.def')

    const withoutLink = wrapTemplateHtml(BODY, 'Acme MC Co', null)
    expect(withoutLink).not.toContain('Unsubscribe')
  })

  it('rejects a non-http unsubscribe URL and escapes a hostile postal address', () => {
    const branding = buildPublicBranding({ postal_address: '<script>alert(1)</script>' })
    const html = wrapTemplateHtml(BODY, 'Acme MC Co', branding, 'javascript:alert(1)')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('business name with double quote does not break the alt attribute', () => {
    const branding = buildPublicBranding({
      logo_url: 'https://cdn.example.com/logo.png',
      business_name: 'Sarah & Co "Creative"',
    })
    const html = wrapTemplateHtml(BODY, 'Sarah & Co "Creative"', branding)
    // The alt attribute must be properly quoted and not contain a raw "
    expect(html).toMatch(/alt="[^"]*Sarah &amp; Co &quot;Creative&quot;[^"]*"/)
    // Should not contain an unescaped quote that would terminate the alt attribute
    expect(html).not.toContain('alt="Sarah & Co "')
  })

  it('renders partial footer fields: ABN and phone without postal address', () => {
    const branding = buildPublicBranding({
      business_name: 'Acme MC Co',
      abn: '12 345 678 901',
      phone: '+61 2 9000 0000',
    })
    const html = wrapTemplateHtml(BODY, 'Acme MC Co', branding)
    expect(html).toContain('ABN 12 345 678 901')
    expect(html).toContain('+61 2 9000 0000')
    // Check that the separator is present between the two fields
    expect(html).toMatch(/ABN 12 345 678 901 &middot; \+61 2 9000 0000/)
    expect(html).not.toContain('Smith St')
  })

  it('renders partial footer fields: only phone', () => {
    const branding = buildPublicBranding({
      business_name: 'Acme MC Co',
      phone: '+61 2 9000 0000',
    })
    const html = wrapTemplateHtml(BODY, 'Acme MC Co', branding)
    // Verify the phone is present but not as a joined list with separators
    expect(html).toContain('+61 2 9000 0000')
    // Should not have stray separators with empty fields
    expect(html).not.toMatch(/&middot;\s*&middot;/)
  })
})

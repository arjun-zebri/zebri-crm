/**
 * The contract email's call-to-action block (`lib/email/html`).
 *
 * Two properties matter here and both are pinned below:
 *
 *  1. The single-signer output is UNCHANGED. Every contract email sent before
 *     the shared-inbox fix used one button and one "Or copy this link" line;
 *     the multi-link support must not have rewritten that path.
 *  2. A shared inbox gets one clearly-named button per signer, each carrying
 *     that signer's own token. Sending one link, or two identical-looking
 *     emails, are the two failure modes this replaced.
 */
import { describe, expect, it } from 'vitest'

import { buildPublicBranding } from '@/lib/branding/public-branding'
import { contractHtml, contractReminderHtml } from '@/lib/email/html'

const base = {
  coupleName: 'Sarah',
  contractNumber: 'C-001',
  contractTitle: 'Wedding MC Agreement',
  expiresAt: null,
  shareUrl: 'https://app.test/contract/shared-token',
  mcBusinessName: 'Zebri Weddings',
}

describe('contractHtml', () => {
  it('renders one CTA and one copy line when no links are given', () => {
    const html = contractHtml(base)
    expect(html).toContain('Review &amp; Sign Contract')
    expect(html).toContain('Or copy this link:')
    // Exactly one button.
    expect(html.match(/Review &amp; Sign Contract/g)).toHaveLength(1)
  })

  it('is byte-identical with a single link and with none', () => {
    // A one-signer contract must not render differently just because the route
    // now always passes a links array.
    const withoutLinks = contractHtml(base)
    const withOneLink = contractHtml({
      ...base,
      links: [{ name: 'Sarah', url: base.shareUrl }],
    })
    expect(withOneLink).toBe(withoutLinks)
  })

  it('renders a named button per signer for a shared inbox', () => {
    const html = contractHtml({
      ...base,
      coupleName: 'Sarah and James',
      links: [
        { name: 'Sarah', url: 'https://app.test/contract/tok-a' },
        { name: 'James', url: 'https://app.test/contract/tok-b' },
      ],
    })

    expect(html).toContain('Sign as Sarah')
    expect(html).toContain('Sign as James')
    // Each signer's OWN token has to survive into the email; sending one link
    // twice is the bug this replaced.
    expect(html).toContain('https://app.test/contract/tok-a')
    expect(html).toContain('https://app.test/contract/tok-b')
    expect(html).toContain('You each sign separately')
  })

  it('escapes signer names rather than interpolating markup', () => {
    const html = contractHtml({
      ...base,
      links: [
        { name: '<script>alert(1)</script>', url: 'https://app.test/contract/a' },
        { name: 'James', url: 'https://app.test/contract/b' },
      ],
    })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('applies the same rules to the branded wrapper', () => {
    const branding = buildPublicBranding({ business_name: 'Zebri Weddings' })
    const html = contractHtml(
      {
        ...base,
        links: [
          { name: 'Sarah', url: 'https://app.test/contract/tok-a' },
          { name: 'James', url: 'https://app.test/contract/tok-b' },
        ],
      },
      branding,
    )
    expect(html).toContain('Sign as Sarah')
    expect(html).toContain('Sign as James')
  })
})

describe('contractReminderHtml', () => {
  it('keeps its single-button output unchanged', () => {
    const html = contractReminderHtml(base)
    expect(html).toContain('Review &amp; Sign')
    expect(html).toContain('Or copy this link:')
    expect(contractReminderHtml({ ...base, links: [{ name: 'Sarah', url: base.shareUrl }] })).toBe(
      html,
    )
  })

  it('chases both outstanding signers at a shared address', () => {
    // The reminder cron had the identical dedup bug, so partner 2 was never
    // nudged either.
    const html = contractReminderHtml({
      ...base,
      links: [
        { name: 'Sarah', url: 'https://app.test/contract/tok-a' },
        { name: 'James', url: 'https://app.test/contract/tok-b' },
      ],
    })
    expect(html).toContain('Sign as Sarah')
    expect(html).toContain('Sign as James')
    expect(html).toContain('tok-a')
    expect(html).toContain('tok-b')
  })
})

/**
 * Run sheet copy, per audience.
 *
 * The step sends one email to suppliers and a different one to the
 * couple, so the thing to pin is that they stay different, that both
 * only use variables the resolver can fill, and that a custom message
 * saved before the field went away still overrides both.
 */
import { describe, expect, it } from 'vitest'

import {
  RUN_SHEET_COUPLE_MESSAGE,
  RUN_SHEET_MESSAGE,
} from '@/lib/automations/actions/timeline'
import { VARIABLE_CATALOGUE } from '@/lib/automations/variables'
import { wrapAutomationShell } from '@/lib/email/html'

/** Every `{{token}}` a piece of copy uses. */
function tokensIn(copy: string): string[] {
  return [...copy.matchAll(/\{\{\s*(.+?)\s*\}\}/g)].map((m) => m[1]!)
}

const KNOWN = new Set(
  VARIABLE_CATALOGUE.flatMap((g) => g.variables).map((v) =>
    v.token.replace(/[{}]/g, '').trim(),
  ),
)

describe('run sheet copy', () => {
  it('says something different to each audience', () => {
    expect(RUN_SHEET_MESSAGE).not.toBe(RUN_SHEET_COUPLE_MESSAGE)
  })

  it('only uses variables the resolver knows', () => {
    // An unknown token renders empty, which reads as a typo in the
    // MC's own email.
    for (const copy of [RUN_SHEET_MESSAGE, RUN_SHEET_COUPLE_MESSAGE]) {
      for (const token of tokensIn(copy)) {
        expect(KNOWN.has(token), token).toBe(true)
      }
    }
  })

  it('asks the supplier to check their own slot, and to reply', () => {
    // The old copy said "let me know if anything looks off", which
    // named no action and nothing to look at.
    expect(RUN_SHEET_MESSAGE).toMatch(/your own schedule/)
    expect(RUN_SHEET_MESSAGE).toMatch(/reply/)
  })

  it('does not ask the couple to proofread a call sheet', () => {
    expect(RUN_SHEET_COUPLE_MESSAGE).not.toMatch(/your own schedule/)
    expect(RUN_SHEET_COUPLE_MESSAGE).toMatch(/\{\{couple\.primary_name\}\}/)
  })

  it('signs off as the MC, not as the software', () => {
    for (const copy of [RUN_SHEET_MESSAGE, RUN_SHEET_COUPLE_MESSAGE]) {
      expect(copy).toMatch(/\{\{mc\.contact_name\}\}/)
    }
  })
})

describe('the run sheet shell', () => {
  const html = wrapAutomationShell('Have a look.', 'Acme MC Co', {
    label: 'View run sheet',
    url: 'https://app.zebri.com.au/timeline/abc',
  })

  it('renders the link as a button with the address underneath', () => {
    // A bare URL in the body is a link the recipient has to notice
    // and select; every other couple-facing email gives it a button,
    // and the address for clients that strip them.
    expect(html).toContain('View run sheet')
    expect(html).toContain('Or copy this link')
    expect(html).toContain('href="https://app.zebri.com.au/timeline/abc"')
  })

  it('renders nothing extra when there is no link', () => {
    const plain = wrapAutomationShell('Just words.', 'Acme MC Co')
    expect(plain).not.toContain('Or copy this link')
    expect(plain).toContain('Just words.')
  })

  it('refuses a link that is not http(s)', () => {
    // `safeUrl` gates the href, so a javascript: URL cannot reach the
    // couple's inbox as a button.
    const unsafe = wrapAutomationShell('Hi.', 'Acme MC Co', {
      label: 'Click',
      url: 'javascript:alert(1)',
    })
    expect(unsafe).not.toContain('Click')
    expect(unsafe).not.toContain('javascript:')
  })

  it('escapes the label and the body', () => {
    const escaped = wrapAutomationShell('<script>x</script>', 'Acme MC Co', {
      label: '<b>Go</b>',
      url: 'https://app.zebri.com.au/timeline/abc',
    })
    expect(escaped).not.toContain('<script>')
    expect(escaped).not.toContain('<b>Go</b>')
  })
})

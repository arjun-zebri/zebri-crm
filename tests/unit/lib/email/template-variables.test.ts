/**
 * Sample-context tests for the template editor preview.
 *
 * The editor preview promises "filled with example data" — so the
 * regression that matters is a catalogue variable silently resolving to
 * empty and rendering as an amber "missing" chip (this happened to the
 * `questionnaire.*` namespace). Assert every catalogue variable
 * resolves, and that the MC's real signature + branding thread through.
 */
import { describe, expect, it } from 'vitest'

import { resolveVariable, VARIABLE_CATALOGUE } from '@/lib/automations/variables'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import { buildSampleContext } from '@/lib/email/template-variables'

describe('buildSampleContext', () => {
  it('resolves EVERY catalogue variable to a non-empty sample value', () => {
    const ctx = buildSampleContext({ businessName: 'Acme MC Co', contactName: 'Charlie' })
    for (const group of VARIABLE_CATALOGUE) {
      for (const v of group.variables) {
        const expr = v.token.replace(/[{}]/g, '').trim()
        expect(resolveVariable(expr, ctx), `${v.token} should preview as sample data`).not.toBe('')
      }
    }
  })

  it('uses the MC real signature when provided', () => {
    const signature = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cheers, Charlie' }] }],
    }
    const ctx = buildSampleContext({ businessName: 'Acme', contactName: 'Charlie', signature })
    expect(ctx.mc.signature).toBe(signature)
    // The flattened signature is what `{{mc.signature}}` resolves to in
    // subjects / plain-text channels.
    expect(resolveVariable('mc.signature', ctx)).toBe('Cheers, Charlie')
  })

  it('falls back to a generic sign-off when no signature is saved', () => {
    const ctx = buildSampleContext({ businessName: 'Acme MC Co', contactName: 'Charlie', signature: null })
    expect(resolveVariable('mc.signature', ctx)).toContain('Warm regards')
  })

  it('threads branding through for the shell preview', () => {
    const branding = buildPublicBranding({ brand_color: '#123456' })
    const ctx = buildSampleContext({ businessName: 'Acme', contactName: 'Charlie', signature: null, branding })
    expect(ctx.mc.branding).toBe(branding)
  })
})

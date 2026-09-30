/**
 * Variable resolver tests.
 *
 * Covers the Mustache-style template renderer in
 * `lib/automations/variables` - namespace dispatch, missing
 * fields, pipe filters (friendly, default, currency), and the
 * step-results fallback path that lets later steps reference
 * earlier outputs.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import { linkLabel, linkLabelForUrl, renderTemplate, VARIABLE_CATALOGUE } from '@/lib/automations/variables'
import type { RunContext } from '@/types/automations'

function makeCtx(overrides: Partial<RunContext> = {}): RunContext {
  return {
    userId: 'u',
    automationId: 'a',
    runId: 'r',
    instanceId: 'r',
    stepId: 's',
    coupleId: 'c',
    triggerEvent: {
      id: 'e',
      user_id: 'u',
      source_table: 'couples',
      source_id: 'c',
      event_type: 'new_enquiry' as never,
      payload: {} as never,
      couple_id: 'c',
      created_at: new Date().toISOString(),
      processed_at: null,
      error_message: null,
    },
    couple: {
      id: 'c',
      name: 'Sam & Alex',
      email: 'sam@example.com',
      phone: '0412 345 678',
      eventDate: '2026-12-12',
      venue: 'The Calile',
      status: 'confirmed',
      primaryName: 'Sam',
      spouseName: 'Alex',
      spouseEmail: 'alex@example.com',
      spousePhone: null,
      timezone: 'Australia/Sydney',
    },
    invoice: null,
    mc: {
      userId: 'u',
      businessName: 'Acme MC Co',
      contactName: 'Charlie',
      email: 'charlie@acmemc.com',
      phone: null,
      brandColor: null,
      logoUrl: null,
      quietHoursStart: '21:00',
      quietHoursEnd: '08:00',
      quietHoursTimezone: 'Australia/Sydney',
    },
    actionResults: {},
    ...overrides,
  }
}

describe('renderTemplate', () => {
  it('renders couple namespace fields', () => {
    const ctx = makeCtx()
    expect(renderTemplate('Hi {{couple.primary_name}} & {{couple.spouse_name}}', ctx)).toBe('Hi Sam & Alex')
    expect(renderTemplate('{{couple.email}}', ctx)).toBe('sam@example.com')
  })

  it('renders event namespace, including derived days_until', () => {
    const ctx = makeCtx({ couple: { ...makeCtx().couple!, eventDate: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10) } })
    const out = renderTemplate('{{event.days_until}}', ctx)
    expect(Number(out)).toBeGreaterThanOrEqual(6)
    expect(Number(out)).toBeLessThanOrEqual(7)
  })

  it('applies the friendly filter to event.date', () => {
    const ctx = makeCtx()
    const out = renderTemplate('{{event.date | friendly}}', ctx)
    expect(out).toMatch(/Sat|2026/)
  })

  it('falls back via the default filter when a value is missing', () => {
    const ctx = makeCtx({ couple: { ...makeCtx().couple!, spouseName: null } })
    expect(renderTemplate('{{couple.spouse_name | default:partner}}', ctx)).toBe('partner')
  })

  it('returns empty string for unknown namespaces', () => {
    const ctx = makeCtx()
    expect(renderTemplate('{{nope.foo}}', ctx)).toBe('')
  })

  it('resolves {{questionnaire.link}} from a prior send-questionnaire action', () => {
    const ctx = makeCtx({
      actionResults: { 'action-1': { questionnaire_link: 'https://example.com/questionnaire/xyz' } as never },
    })
    expect(renderTemplate('{{questionnaire.link}}', ctx)).toBe('https://example.com/questionnaire/xyz')
  })

  it('leaves {{questionnaire.link}} empty when no questionnaire is in context', () => {
    expect(renderTemplate('{{questionnaire.link}}', makeCtx())).toBe('')
  })
})

describe('portal links', () => {
  /** A context whose couple has sharing on and all three tokens. */
  function withTokens(overrides: Record<string, unknown> = {}) {
    const ctx = makeCtx()
    return {
      ...ctx,
      couple: {
        ...ctx.couple!,
        portalToken: 'tok-primary',
        secondaryPortalToken: 'tok-partner',
        portalEnabled: true,
        runSheetToken: 'tok-run-sheet',
        runSheetEnabled: true,
        ...overrides,
      },
    }
  }

  it('gives each partner their own portal link', () => {
    // Separate tokens, so each partner's portal edits are attributed
    // to them rather than to "the couple".
    const ctx = withTokens()
    expect(renderTemplate('{{portal.link}}', ctx)).toContain('/portal/tok-primary')
    expect(renderTemplate('{{portal.partner_link}}', ctx)).toContain('/portal/tok-partner')
  })

  it('resolves the vendor run sheet link', () => {
    expect(renderTemplate('{{portal.vendor_link}}', withTokens())).toContain(
      '/timeline/tok-run-sheet',
    )
  })

  it('resolves nothing when sharing is off, rather than a link that 404s', () => {
    // Both partner tokens hang off the one `portal_token_enabled`
    // flag, and the portal RPCs refuse a token whose couple has it
    // off. An empty variable pauses the run and alerts the MC; a dead
    // URL just reaches the couple.
    const off = withTokens({ portalEnabled: false })
    expect(renderTemplate('{{portal.link}}', off)).toBe('')
    expect(renderTemplate('{{portal.partner_link}}', off)).toBe('')

    const noRunSheet = withTokens({ runSheetEnabled: false })
    expect(renderTemplate('{{portal.vendor_link}}', noRunSheet)).toBe('')
  })

  it('prefers the link a preceding send-portal-link step used', () => {
    const ctx = withTokens()
    const stamped = {
      ...ctx,
      triggerEvent: { ...ctx.triggerEvent, payload: { portal_link: 'https://x.test/p/abc' } },
    } as typeof ctx
    expect(renderTemplate('{{portal.link}}', stamped)).toBe('https://x.test/p/abc')
    // …but only for the link it actually stamped.
    expect(renderTemplate('{{portal.partner_link}}', stamped)).toContain('/portal/tok-partner')
  })

  it('offers all three in the catalogue the editors read', () => {
    const tokens = VARIABLE_CATALOGUE.flatMap((g) => g.variables).map((v) => v.token)
    expect(tokens).toContain('{{portal.link}}')
    expect(tokens).toContain('{{portal.partner_link}}')
    expect(tokens).toContain('{{portal.vendor_link}}')
  })
})

describe('linkLabel', () => {
  it('returns the couple-facing label for every catalogued link variable', () => {
    expect(linkLabel('portal.link')).toBe('View your portal')
    expect(linkLabel('portal.partner_link')).toBe('View your portal')
    expect(linkLabel('portal.vendor_link')).toBe('View the run sheet')
    expect(linkLabel('invoice.link')).toBe('View and pay your invoice')
    expect(linkLabel('contract.link')).toBe('Review and sign your contract')
    expect(linkLabel('questionnaire.link')).toBe('Fill in your questionnaire')
    expect(linkLabel('quote.link')).toBe('View your quote')
    expect(linkLabel('mc.review_link')).toBe('Leave a review')
  })

  it('ignores filters on the expression', () => {
    expect(linkLabel('portal.link | default:x')).toBe('View your portal')
  })

  it('returns null for a non-link variable', () => {
    expect(linkLabel('couple.primary_name')).toBeNull()
    expect(linkLabel('invoice.number')).toBeNull()
  })
})

describe('linkLabelForUrl', () => {
  it('labels each share route this app mints', () => {
    expect(linkLabelForUrl('https://app.zebri.com.au/portal/tok')).toBe('View your portal')
    expect(linkLabelForUrl('https://app.zebri.com.au/timeline/tok')).toBe('View the run sheet')
    expect(linkLabelForUrl('https://app.zebri.com.au/invoice/tok')).toBe('View and pay your invoice')
    expect(linkLabelForUrl('https://app.zebri.com.au/contract/tok')).toBe('Review and sign your contract')
    expect(linkLabelForUrl('https://app.zebri.com.au/questionnaire/tok')).toBe('Fill in your questionnaire')
  })

  it('returns null for another host, an unknown route, or a non-URL', () => {
    expect(linkLabelForUrl('https://example.com/portal/tok')).toBeNull()
    expect(linkLabelForUrl('https://app.zebri.com.au/about')).toBeNull()
    expect(linkLabelForUrl('not a url')).toBeNull()
  })
})

describe('proposal variables', () => {
  const base = {
    userId: 'u1', automationId: 'a', runId: 'r', instanceId: 'r', stepId: 's', coupleId: 'c1',
    couple: null, invoice: null,
    mc: { userId: 'u1', businessName: 'Acme MC', contactName: 'Charlie', email: 'c@acme.test', phone: null, brandColor: null, logoUrl: null, quietHoursStart: null, quietHoursEnd: null, quietHoursTimezone: 'Australia/Sydney' },
    actionResults: {},
  }
  function withEvent(source_table: string, payload: Record<string, unknown>, actionResults = {}) {
    return { ...base, actionResults, triggerEvent: { source_table, payload } as never } as unknown as RunContext
  }

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.zebri.test'
  })

  it('builds the link from a lifecycle payload share token', () => {
    const ctx = withEvent('proposals', { share_token: 'tok', proposal_number: 'PR-001', title: 'Wedding MC' })
    expect(renderTemplate('{{proposal.link}}', ctx)).toBe('https://app.zebri.test/proposal/tok')
    expect(renderTemplate('{{proposal.number}}', ctx)).toBe('PR-001')
    expect(renderTemplate('{{proposal.title}}', ctx)).toBe('Wedding MC')
  })

  it("prefers a send_proposal step's output", () => {
    const ctx = withEvent('proposals', { share_token: 'old' }, {
      s1: { proposal_link: 'https://app.zebri.test/proposal/new', proposal_title: 'Fresh' },
    })
    expect(renderTemplate('{{proposal.link}}', ctx)).toBe('https://app.zebri.test/proposal/new')
    expect(renderTemplate('{{proposal.title}}', ctx)).toBe('Fresh')
  })

  it('does not borrow a title from a non-proposal payload', () => {
    const ctx = withEvent('contracts', { title: 'MC agreement', share_token: 'x' })
    expect(renderTemplate('{{proposal.title}}', ctx)).toBe('')
    expect(renderTemplate('{{proposal.link}}', ctx)).toBe('')
  })

  it('labels the link for email bodies', () => {
    expect(linkLabel('proposal.link')).toBe('View your proposal')
    expect(linkLabelForUrl('https://app.zebri.test/proposal/tok')).toBe('View your proposal')
  })

  it('lists the three variables in the catalogue', () => {
    const tokens = VARIABLE_CATALOGUE.flatMap((g) => g.variables.map((v) => v.token))
    expect(tokens).toEqual(expect.arrayContaining(['{{proposal.link}}', '{{proposal.number}}', '{{proposal.title}}']))
  })
})

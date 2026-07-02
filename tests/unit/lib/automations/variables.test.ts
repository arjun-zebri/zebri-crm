/**
 * Variable resolver tests.
 *
 * Covers the Mustache-style template renderer in
 * `lib/automations/variables` - namespace dispatch, missing
 * fields, pipe filters (friendly, default, currency), and the
 * step-results fallback path that lets later steps reference
 * earlier outputs.
 */
import { describe, expect, it } from 'vitest'

import { renderTemplate } from '@/lib/automations/variables'
import type { RunContext } from '@/types/automations'

function makeCtx(overrides: Partial<RunContext> = {}): RunContext {
  return {
    userId: 'u',
    automationId: 'a',
    runId: 'r',
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

  it('reads from prior action outputs when payload lacks the field', () => {
    const ctx = makeCtx({
      actionResults: { 'action-1': { quote_link: 'https://example.com/q/abc' } as never },
    })
    expect(renderTemplate('{{quote.link}}', ctx)).toBe('https://example.com/q/abc')
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

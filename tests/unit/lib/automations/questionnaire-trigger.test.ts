/**
 * Unit tests for the `questionnaire_completed` trigger spec and the
 * questionnaire variable namespace: template narrowing in `match()`, and
 * `{{questionnaire.link}}` / `{{questionnaire.title}}` resolving from a
 * completion event payload (link built from the payload's share token) or
 * from a preceding send action's results.
 */
import { describe, expect, it } from 'vitest'

import { getTriggerSpec } from '@/lib/automations/triggers'
import { renderTemplate } from '@/lib/automations/variables'
import type { AutomationEventRow, RunContext } from '@/types/automations'

function completionEvent(payload: Record<string, unknown>): AutomationEventRow {
  return {
    id: 'e',
    user_id: 'u',
    source_table: 'couple_questionnaires',
    source_id: 'q',
    event_type: 'questionnaire_completed' as never,
    payload: payload as never,
    couple_id: 'c',
    created_at: new Date().toISOString(),
    processed_at: null,
    error_message: null,
  }
}

function ctxWith(payload: Record<string, unknown>, actionResults: RunContext['actionResults'] = {}): RunContext {
  return {
    userId: 'u',
    automationId: 'a',
    runId: 'r',
    coupleId: 'c',
    triggerEvent: completionEvent(payload),
    couple: null,
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
    actionResults,
  }
}

describe('questionnaire_completed trigger', () => {
  const spec = getTriggerSpec('questionnaire_completed')!

  it('is registered with a portal UI entry', () => {
    expect(spec).toBeTruthy()
    expect(spec.ui.label).toBe('Questionnaire completed')
  })

  it('matches every completion when no template filter is set', () => {
    expect(spec.match(completionEvent({ template_id: 't1' }), {})).toBe(true)
    expect(spec.match(completionEvent({ template_id: null }), {})).toBe(true)
  })

  it('narrows to one template when configured', () => {
    const config = { questionnaireTemplateId: 't1' }
    expect(spec.match(completionEvent({ template_id: 't1' }), config)).toBe(true)
    expect(spec.match(completionEvent({ template_id: 't2' }), config)).toBe(false)
    // Snapshot rows whose template was deleted carry null — no match.
    expect(spec.match(completionEvent({ template_id: null }), config)).toBe(false)
  })
})

describe('questionnaire variables', () => {
  it('resolves title from the completion payload', () => {
    const ctx = ctxWith({ questionnaire_id: 'q', title: 'Ceremony details' })
    expect(renderTemplate('{{questionnaire.title}}', ctx)).toBe('Ceremony details')
  })

  it('builds the fill link from the completion payload share token', () => {
    const ctx = ctxWith({ questionnaire_id: 'q', share_token: 'tok-123' })
    expect(renderTemplate('{{questionnaire.link}}', ctx)).toMatch(/\/questionnaire\/tok-123$/)
  })

  it('does not borrow share tokens from non-questionnaire payloads', () => {
    const ctx = ctxWith({ share_token: 'contract-token' })
    expect(renderTemplate('{{questionnaire.link}}', ctx)).toBe('')
  })

  it('prefers a preceding send action result over payload fallback', () => {
    const ctx = ctxWith({ questionnaire_id: 'q', share_token: 'tok-123' }, { step1: { questionnaire_link: 'https://x/questionnaire/abc' } })
    expect(renderTemplate('{{questionnaire.link}}', ctx)).toBe('https://x/questionnaire/abc')
  })
})

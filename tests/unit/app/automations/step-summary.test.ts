/**
 * Collapsed-card summaries.
 *
 * The card is how an MC knows a step is configured without opening
 * it, so a step whose summary never changes reads as one that never
 * saved — which is exactly how the questionnaire step looked before
 * it had a case here.
 */
import { describe, expect, it } from 'vitest'

import { stepSummary } from '@/app/(dashboard)/automations/[id]/step-summary'
import type { AutomationActionRow } from '@/types/automations'

function row(type: string, config: Record<string, unknown>): AutomationActionRow {
  return { id: 'a1', type, config, label: null } as unknown as AutomationActionRow
}

const LABELS = { questionnaires: { q1: 'Ceremony details' } }

describe('the questionnaire step summary', () => {
  it('names the chosen questionnaire', () => {
    // The config stores an id; the name lives in the database, so the
    // builder passes the lookup it already loaded for the picker.
    expect(stepSummary(row('send_couple_questionnaire', { questionnaireTemplateId: 'q1' }), LABELS)).toBe(
      'Ceremony details',
    )
  })

  it('prefers the title override, since that is what the couple sees', () => {
    expect(
      stepSummary(
        row('send_couple_questionnaire', { questionnaireTemplateId: 'q1', title: 'A few questions' }),
        LABELS,
      ),
    ).toBe('A few questions')
  })

  it('says so when nothing is chosen', () => {
    expect(stepSummary(row('send_couple_questionnaire', {}), LABELS)).toBe('No questionnaire chosen')
  })

  it('degrades without a lookup rather than showing a raw id', () => {
    expect(stepSummary(row('send_couple_questionnaire', { questionnaireTemplateId: 'q1' }))).toBe(
      'Sends a questionnaire',
    )
  })
})

describe('other step summaries', () => {
  it('names the run sheet audience', () => {
    expect(stepSummary(row('send_timeline_to_vendors', {}))).toBe('Sends the run sheet to vendors')
    expect(
      stepSummary(row('send_timeline_to_vendors', { sendToVendors: false, sendToMe: true })),
    ).toBe('Sends the run sheet to me')
  })

  it('leads a pre-composed email with its subject', () => {
    expect(stepSummary(row('request_review', { subject: 'How did we do?' }))).toBe(
      'Subject: How did we do?',
    )
    expect(stepSummary(row('send_thank_you_message', {}))).toBe('No subject yet')
  })

  it('leads a timeline item with its title, and its time when set', () => {
    expect(stepSummary(row('create_timeline_event', { title: 'Ceremony' }))).toBe('Ceremony')
    expect(
      stepSummary(row('create_timeline_event', { title: 'Ceremony', startTime: '15:30' })),
    ).toBe('Ceremony at 3:30 pm')
    expect(stepSummary(row('create_timeline_event', {}))).toBe('No title yet')
  })

  it('names the couple a create step will make', () => {
    expect(stepSummary(row('create_couple', { name: 'Anna & Jake' }))).toBe('Creates Anna & Jake')
    expect(stepSummary(row('create_couple', {}))).toBe('No couple name yet')
  })
})

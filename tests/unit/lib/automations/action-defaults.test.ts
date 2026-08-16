/**
 * Reading a step's config the way the runner will.
 *
 * Several actions carry their copy as Zod `.default()` values, applied
 * when the runner parses rather than when the step is created. So a
 * freshly added post-event email stores `{}` while the email it would
 * send is fully written — and anything rendering the raw config shows
 * an empty modal and a card claiming there is no subject.
 */
import { describe, expect, it } from 'vitest'

import { configWithDefaults } from '@/lib/automations/action-defaults'

describe('configWithDefaults', () => {
  it('fills in copy the step never stored', () => {
    const filled = configWithDefaults('send_thank_you_message', {})
    expect(typeof filled['subject']).toBe('string')
    expect(String(filled['subject']).length).toBeGreaterThan(0)
    expect(String(filled['body'])).toContain('{{couple.primary_name}}')
  })

  it('leaves an edited value alone', () => {
    const filled = configWithDefaults('send_thank_you_message', { subject: 'Mine' })
    expect(filled['subject']).toBe('Mine')
    // …while still filling the half the MC did not touch.
    expect(String(filled['body']).length).toBeGreaterThan(0)
  })

  it('returns the config untouched for an unknown action', () => {
    const config = { anything: 1 }
    expect(configWithDefaults('not_an_action', config)).toBe(config)
  })

  it('returns the config untouched when it does not parse', () => {
    // A half-configured step is still one the MC has to be able to
    // open and finish, so this must not throw or blank it.
    const config = { questionnaireTemplateId: 'not-a-uuid' }
    expect(configWithDefaults('send_couple_questionnaire', config)).toBe(config)
  })

  it('adds nothing to an action that defaults nothing', () => {
    expect(configWithDefaults('add_note', { text: 'hi' })).toEqual({ text: 'hi' })
  })
})

/**
 * Commercial vs transactional send classification (Task 13).
 *
 * This is deliberately a data lookup, not branching logic, because the
 * plan's standing decision (docs/superpowers/plans/2026-09-23-workflows-trust-remediation.md,
 * "Blocking decision before Task 10") is provisional until a lawyer signs
 * off: invoices and signed contracts are plainly transactional, everything
 * else automated defaults to commercial until told otherwise. These tests
 * pin that default and the two named exceptions so a future change to the
 * allow-list is a one-line data edit, not a renderer rewrite.
 */
import { describe, expect, it } from 'vitest'

import { isTransactionalSend, TRANSACTIONAL_ACTION_TYPES } from '@/lib/email/commercial-classification'

describe('isTransactionalSend', () => {
  it('treats send_invoice and send_contract as transactional (no unsubscribe link needed)', () => {
    expect(isTransactionalSend('send_invoice')).toBe(true)
    expect(isTransactionalSend('send_contract')).toBe(true)
  })

  it('treats the plainly commercial post-event actions as commercial', () => {
    expect(isTransactionalSend('request_review')).toBe(false)
    expect(isTransactionalSend('send_referral_request')).toBe(false)
    expect(isTransactionalSend('send_anniversary_message')).toBe(false)
    expect(isTransactionalSend('send_thank_you_message')).toBe(false)
  })

  it('defaults everything else automated to commercial (the stricter reading)', () => {
    expect(isTransactionalSend('send_email')).toBe(false)
    expect(isTransactionalSend('send_couple_questionnaire')).toBe(false)
  })

  it('defaults an unknown or missing action type to commercial', () => {
    expect(isTransactionalSend(null)).toBe(false)
    expect(isTransactionalSend(undefined)).toBe(false)
  })

  it('exposes the allow-list as data, not scattered conditionals', () => {
    expect(TRANSACTIONAL_ACTION_TYPES.has('send_invoice')).toBe(true)
    expect(TRANSACTIONAL_ACTION_TYPES.has('send_contract')).toBe(true)
    expect(TRANSACTIONAL_ACTION_TYPES.size).toBe(2)
  })
})

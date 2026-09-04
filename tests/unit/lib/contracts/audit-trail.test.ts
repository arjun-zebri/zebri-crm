/**
 * Certificate wording (`lib/contracts/audit-trail`).
 *
 * The certificate is read by people who have never used Zebri, so every event
 * type must produce a sentence rather than a code, and an unknown type must
 * degrade instead of breaking the document.
 */
import { describe, expect, it } from 'vitest'

import {
  describeEvent,
  formatFingerprint,
  type AuditTrailEvent,
} from '@/lib/contracts/audit-trail'

const event = (over: Partial<AuditTrailEvent> & { event_type: string }): AuditTrailEvent => ({
  actor: 'couple',
  event_at: '2026-08-12T09:04:00Z',
  ...over,
})

describe('describeEvent', () => {
  it('names the supplier by their trade', () => {
    expect(describeEvent(event({ event_type: 'sent' }), 'celebrant')).toBe(
      'Contract sent by the celebrant',
    )
    expect(describeEvent(event({ event_type: 'revoked' }), 'DJ')).toBe(
      'Contract withdrawn by the DJ',
    )
  })

  it('names the person where one is recorded', () => {
    expect(
      describeEvent(event({ event_type: 'signed', signer_name_typed: 'Sarah' }), 'MC'),
    ).toBe('Signed by Sarah')
    expect(
      describeEvent(event({ event_type: 'viewed', signer_name_typed: 'James' }), 'MC'),
    ).toBe('Opened by James')
  })

  it('falls back gracefully when no name was captured', () => {
    expect(describeEvent(event({ event_type: 'viewed' }), 'MC')).toBe('Contract opened')
    expect(describeEvent(event({ event_type: 'signed' }), 'MC')).toBe('Signed')
  })

  it('quotes a decline reason and copes without one', () => {
    expect(
      describeEvent(
        event({ event_type: 'declined', decline_reason: 'Changed our plans' }),
        'MC',
      ),
    ).toBe('Declined: "Changed our plans"')
    expect(describeEvent(event({ event_type: 'declined' }), 'MC')).toBe('Declined')
    expect(describeEvent(event({ event_type: 'declined', decline_reason: '   ' }), 'MC')).toBe(
      'Declined',
    )
  })

  it('numbers reminders when the number is known', () => {
    expect(describeEvent(event({ event_type: 'reminder_sent', reminder_number: 2 }), 'MC')).toBe(
      'Reminder 2 sent',
    )
    expect(describeEvent(event({ event_type: 'reminder_sent' }), 'MC')).toBe('Reminder sent')
  })

  it('describes the events the signing controls introduced', () => {
    expect(
      describeEvent(
        event({ event_type: 'identity_verified', signer_name_typed: 'Sarah' }),
        'MC',
      ),
    ).toBe('Sarah verified their email address')
    expect(
      describeEvent(event({ event_type: 'invite_sent', signer_name_typed: 'James' }), 'MC'),
    ).toBe('Signing invitation sent to James')
  })

  it('degrades on an unknown event type rather than throwing', () => {
    // A certificate that fails to render because a newer event type reached an
    // older client is far worse than one that says "Contract event".
    expect(describeEvent(event({ event_type: 'something_new' }), 'MC')).toBe('Contract event')
  })

  it('covers every event type the audit log allows', () => {
    const types = [
      'sent', 'viewed', 'signed', 'declined', 'expired', 'revoked',
      'reminder_sent', 'invite_sent', 'identity_verified',
    ]
    for (const t of types) {
      expect(describeEvent(event({ event_type: t }), 'MC')).not.toBe('Contract event')
    }
  })
})

describe('formatFingerprint', () => {
  it('groups a digest into readable chunks of eight', () => {
    // An unbroken 64-character string cannot be compared by eye, which is the
    // only way most people will ever use it.
    const hash = 'a'.repeat(8) + 'b'.repeat(8) + 'c'.repeat(8) + 'd'.repeat(8) +
      'e'.repeat(8) + 'f'.repeat(8) + '0'.repeat(8) + '1'.repeat(8)
    const out = formatFingerprint(hash)
    expect(out.split(' ')).toHaveLength(8)
    expect(out.replace(/ /g, '')).toBe(hash)
  })

  it('handles an empty string', () => {
    expect(formatFingerprint('')).toBe('')
  })
})

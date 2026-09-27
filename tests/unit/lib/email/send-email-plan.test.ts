/**
 * The send's recipient decisions, as pure helpers (Task 29).
 *
 * `send_email` and the step envelope both call these, so the envelope's
 * "To" line cannot drift from who the send actually mails. These tests
 * pin the decisions themselves; `envelope-send-parity.test.ts` pins that
 * the send and the envelope agree.
 */
import { describe, expect, it, vi } from 'vitest'

const suppressed = new Set<string>()
let coupleStatus: 'clear' | 'blocked' | 'unknown' = 'clear'
let suppressionUnknown = false

vi.mock('@/lib/email/suppression', () => ({
  isCoupleOptedOut: async () =>
    coupleStatus === 'unknown' ? { status: 'unknown', reason: 'db down' } : { status: coupleStatus },
  isEmailSuppressed: async (_s: unknown, _u: string, email: string) =>
    suppressionUnknown
      ? { status: 'unknown', reason: 'rpc down' }
      : { status: suppressed.has(email) ? 'blocked' : 'clear' },
}))

import {
  copiesFor,
  gateOptOuts,
  planRecipients,
  sendAttachmentIds,
  sendReplyTo,
} from '@/lib/email/send-email-plan'
import type { ResolvedRecipient } from '@/types/automations'

function person(role: ResolvedRecipient['role'], email: string | null, name = 'X'): ResolvedRecipient {
  return { role, contactId: null, name, email, phone: null, fallbackApplied: false }
}

describe('planRecipients', () => {
  const recipients = [person('primary', 'sam@x.test', 'Sam'), person('spouse', 'priya@x.test', 'Priya')]

  it('splits every cc and typed bcc into its own message on a commercial send', () => {
    const plan = planRecipients({
      recipients,
      ccCandidates: ['florist@x.test', 'SAM@x.test'],
      typedBcc: ['planner@x.test', 'florist@x.test'],
      bccSelf: false,
      mcEmail: 'mc@x.test',
      commercial: true,
    })
    expect(plan.addressable.map((r) => r.email)).toEqual([
      'sam@x.test',
      'priya@x.test',
      'florist@x.test',
      'planner@x.test',
    ])
    expect(plan.copyRecipients.every((r) => r.role === 'custom')).toBe(true)
    expect(plan.cc).toBeUndefined()
    expect(plan.bcc).toEqual([])
  })

  it("sends the MC their own copy, wherever it was typed, and puts no bcc on the couple's message (I1, P1)", () => {
    const plan = planRecipients({
      recipients,
      ccCandidates: ['MC@x.test'],
      typedBcc: [],
      bccSelf: false,
      mcEmail: 'mc@x.test',
      commercial: true,
    })
    expect(plan.mcCopy).toBe('mc@x.test')
    expect(plan.bcc).toEqual([])
    expect(plan.copyRecipients).toEqual([])
    expect(copiesFor(plan, 'sam@x.test')).toEqual({})
    // The idempotency fingerprint still sees the copy where the bcc was,
    // so a step's keys are the same before and after the split.
    expect(plan.fingerprintBcc).toEqual(['mc@x.test'])
  })

  it('sends no separate copy when the MC is already one of the step’s own recipients', () => {
    const plan = planRecipients({
      recipients: [person('me', 'mc@x.test')],
      ccCandidates: [],
      typedBcc: [],
      bccSelf: true,
      mcEmail: 'mc@x.test',
      commercial: true,
    })
    expect(plan.mcCopy).toBeNull()
  })

  it('has no MC copy unless one was asked for', () => {
    const plan = planRecipients({
      recipients,
      ccCandidates: [],
      typedBcc: [],
      bccSelf: false,
      mcEmail: 'mc@x.test',
      commercial: true,
    })
    expect(plan.mcCopy).toBeNull()
    expect(plan.fingerprintBcc).toEqual([])
  })

  it('never puts the MC bcc on a split-out copy', () => {
    const plan = planRecipients({
      recipients,
      ccCandidates: ['florist@x.test'],
      typedBcc: [],
      bccSelf: true,
      mcEmail: 'mc@x.test',
      commercial: true,
    })
    expect(copiesFor(plan, 'florist@x.test')).toEqual({})
  })

  it('keeps one cc list on every message for a transactional send', () => {
    const plan = planRecipients({
      recipients,
      ccCandidates: ['florist@x.test', 'sam@x.test'],
      typedBcc: ['planner@x.test'],
      bccSelf: true,
      mcEmail: 'mc@x.test',
      commercial: false,
    })
    expect(plan.cc).toEqual(['florist@x.test'])
    expect(plan.bcc).toEqual(['planner@x.test'])
    expect(plan.mcCopy).toBe('mc@x.test')
    expect(plan.fingerprintBcc).toEqual(['mc@x.test', 'planner@x.test'])
    expect(plan.copyRecipients).toEqual([])
  })

  it('drops recipients with no address from the addressable list', () => {
    const plan = planRecipients({
      recipients: [person('primary', 'sam@x.test'), person('spouse', null)],
      ccCandidates: [],
      typedBcc: [],
      bccSelf: false,
      mcEmail: null,
      commercial: true,
    })
    expect(plan.addressable).toHaveLength(1)
  })
})

describe('gateOptOuts', () => {
  const people = [
    person('primary', 'sam@x.test'),
    person('vendor', 'florist@x.test'),
    person('custom', 'gone@x.test'),
  ]

  it('drops only the couple’s own roles when the couple opted out', async () => {
    coupleStatus = 'blocked'
    suppressionUnknown = false
    suppressed.clear()
    const gate = await gateOptOuts({} as never, 'u1', 'c1', people)
    expect(gate.status).toBe('ok')
    if (gate.status !== 'ok') return
    expect(gate.sendable.map((r) => r.email)).toEqual(['florist@x.test', 'gone@x.test'])
    expect(gate.skipped).toEqual([{ recipient: people[0], reason: 'couple_opted_out' }])
  })

  it('drops a suppressed address', async () => {
    coupleStatus = 'clear'
    suppressed.clear()
    suppressed.add('gone@x.test')
    const gate = await gateOptOuts({} as never, 'u1', 'c1', people)
    if (gate.status !== 'ok') throw new Error('expected ok')
    expect(gate.skipped).toEqual([{ recipient: people[2], reason: 'suppressed' }])
    expect(gate.sendable).toHaveLength(2)
  })

  it('reports an incomplete check with the send’s own message', async () => {
    coupleStatus = 'unknown'
    expect(await gateOptOuts({} as never, 'u1', 'c1', people)).toEqual({
      status: 'unknown',
      message: 'send_email: could not check the couple opt-out flag (db down)',
    })
    coupleStatus = 'clear'
    suppressionUnknown = true
    expect(await gateOptOuts({} as never, 'u1', 'c1', people)).toEqual({
      status: 'unknown',
      message: 'send_email: could not check the suppression list (rpc down)',
    })
    suppressionUnknown = false
  })
})

describe('sendReplyTo and sendAttachmentIds', () => {
  it('prefers the override, else the MC’s address', () => {
    expect(sendReplyTo('hi@x.test', 'mc@x.test')).toBe('hi@x.test')
    expect(sendReplyTo('', 'mc@x.test')).toBe('mc@x.test')
    expect(sendReplyTo(undefined, 'mc@x.test')).toBe('mc@x.test')
  })

  it('attaches each file once, template files first', () => {
    expect(sendAttachmentIds(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c'])
    expect(sendAttachmentIds([], undefined)).toEqual([])
  })
})

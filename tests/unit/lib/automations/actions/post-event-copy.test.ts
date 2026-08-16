/**
 * The post-event email copy, and the review link behind it.
 *
 * These three emails ship as-is for most MCs, so the defaults are the
 * product. Two things are worth pinning: they only use variables the
 * resolver can fill, and the review request cannot send without a
 * link to send people to — its old default shipped a placeholder
 * `https://g.page/r/your-place`, which would have reached a real
 * couple as a dead link.
 */
import { describe, expect, it, vi } from 'vitest'

import { getActionSpec } from '@/lib/automations/actions'
import { VARIABLE_CATALOGUE } from '@/lib/automations/variables'
import type { RunContext } from '@/types/automations'

vi.mock('resend', () => ({ Resend: class { emails = { send: vi.fn() } } }))

const KNOWN = new Set(
  VARIABLE_CATALOGUE.flatMap((g) => g.variables).map((v) => v.token.replace(/[{}]/g, '').trim()),
)

const TYPES = ['send_thank_you_message', 'request_review', 'send_referral_request'] as const

/** The `subject` + `body` a step sends when nothing is overridden. */
function defaults(type: (typeof TYPES)[number]) {
  const parsed = getActionSpec(type)!.configSchema.safeParse({})
  expect(parsed.success, type).toBe(true)
  return parsed.success ? (parsed.data as { subject: string; body: string }) : { subject: '', body: '' }
}

function tokensIn(copy: string): string[] {
  return [...copy.matchAll(/\{\{\s*(.+?)\s*\}\}/g)].map((m) => m[1]!)
}

describe('post-event copy', () => {
  it('ships a subject and a body for each', () => {
    for (const type of TYPES) {
      const { subject, body } = defaults(type)
      expect(subject.length, type).toBeGreaterThan(0)
      expect(body.length, type).toBeGreaterThan(0)
    }
  })

  it('only uses variables the resolver knows', () => {
    // An unknown token renders empty, which reads as a typo in the
    // MC's own email.
    for (const type of TYPES) {
      const { subject, body } = defaults(type)
      for (const token of [...tokensIn(subject), ...tokensIn(body)]) {
        expect(KNOWN.has(token), `${type}: ${token}`).toBe(true)
      }
    }
  })

  it('signs off as the MC', () => {
    for (const type of TYPES) {
      expect(defaults(type).body, type).toContain('{{mc.contact_name}}')
    }
  })

  it('never hardcodes a link', () => {
    // The review request used to ship a placeholder Google URL in its
    // body; the link is the MC's own setting now.
    for (const type of TYPES) {
      expect(defaults(type).body, type).not.toMatch(/https?:\/\//)
    }
  })
})

/** A context with no couple email, so nothing is actually sent. */
function makeCtx(reviewLink: string | null): RunContext {
  return {
    userId: 'u1',
    automationId: 'a1',
    runId: 'r1',
    coupleId: 'c1',
    triggerEvent: {} as never,
    couple: { id: 'c1', name: 'Sam & Alex', email: null } as never,
    invoice: null,
    mc: { userId: 'u1', businessName: 'Acme', contactName: 'Charlie', email: 'c@a.com', reviewLink } as never,
    actionResults: {},
  }
}

describe('request_review without a link', () => {
  it('fails with a message naming the fix', async () => {
    // Asking for a review with nowhere to leave one is worse than not
    // sending: the run log has to say what to do about it.
    const result = await getActionSpec('request_review')!.handler(makeCtx(null), { subject: 's', body: 'b' } as never)
    expect(result.kind).toBe('error')
    expect(result.kind === 'error' && result.message).toMatch(/Settings/)
  })

  it('gets past that check once the link is set', async () => {
    // No couple email, so it stops at the next guard rather than
    // sending — enough to prove the link check passed.
    const result = await getActionSpec('request_review')!.handler(
      makeCtx('https://g.page/r/abc/review'),
      { subject: 's', body: 'b' } as never,
    )
    expect(result.kind).toBe('ok')
  })
})

describe('retired request_review fields', () => {
  const schema = getActionSpec('request_review')!.configSchema

  it('still parses a config saved against them', () => {
    // platforms / incentive / followUpIfIgnored were declared and
    // never read. An automation saved with them is a live row, so a
    // rejected config would be a step that fails at run time rather
    // than one quietly ignoring a setting it never used.
    const legacy = {
      platforms: ['google', 'facebook'],
      incentive: 'First reviewer wins a bottle',
      followUpIfIgnored: true,
    }
    const parsed = schema.safeParse(legacy)
    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data).toMatchObject(legacy)
  })

  it('still fills the copy those configs never carried', () => {
    const parsed = schema.safeParse({ platforms: ['google'] })
    expect(parsed.success && String((parsed.data as { subject: string }).subject).length)
      .toBeGreaterThan(0)
  })
})

/**
 * Unit coverage for the recipient resolver — specifically the roles
 * that resolve without touching the database (`primary`, `spouse`,
 * `me`) and the fallback rules. DB-backed roles (family / vendor /
 * custom) are exercised by the messaging-handler unit spec with a
 * stubbed client and by the automations integration suite.
 */

import { describe, expect, it } from 'vitest'

import { resolveRecipients } from '@/lib/automations/recipients'
import type { CoupleSnapshot, McSnapshot } from '@/types/automations'

/** Resolver only touches supabase for family/vendor/custom roles. */
const neverClient = new Proxy(
  {},
  {
    get() {
      throw new Error('supabase should not be queried for this role set')
    },
  },
) as never

function makeCouple(overrides: Partial<CoupleSnapshot> = {}): CoupleSnapshot {
  return {
    id: 'c1',
    name: 'Sarah & Jake',
    primaryName: 'Sarah',
    email: 'sarah@example.com',
    phone: null,
    spouseName: 'Jake',
    spouseEmail: null,
    spousePhone: null,
    status: 'quoted',
    timezone: null,
    customFields: {},
    ...overrides,
  } as CoupleSnapshot
}

function makeMc(overrides: Partial<McSnapshot> = {}): McSnapshot {
  return {
    userId: 'u1',
    businessName: 'MC Business',
    contactName: 'Alex MC',
    email: 'alex@mcbusiness.com',
    phone: null,
    brandColor: null,
    logoUrl: null,
    quietHoursStart: null,
    quietHoursEnd: null,
    quietHoursTimezone: null,
    ...overrides,
  } as McSnapshot
}

describe('resolveRecipients — me role', () => {
  it('resolves "me" to the MC email when the MC snapshot is provided', async () => {
    const out = await resolveRecipients(
      neverClient,
      makeCouple(),
      { roles: ['me'], fallback: 'skip' },
      makeMc(),
    )
    expect(out).toHaveLength(1)
    expect(out[0]!.role).toBe('me')
    expect(out[0]!.email).toBe('alex@mcbusiness.com')
    expect(out[0]!.name).toBe('Alex MC')
  })

  it('combines "me" with couple roles', async () => {
    const out = await resolveRecipients(
      neverClient,
      makeCouple(),
      { roles: ['primary', 'me'], fallback: 'skip' },
      makeMc(),
    )
    expect(out.map((r) => r.email).sort()).toEqual([
      'alex@mcbusiness.com',
      'sarah@example.com',
    ])
  })

  it('skips "me" silently when no MC snapshot is available (legacy call sites)', async () => {
    // Callers that haven't threaded the MC through (e.g. timeline
    // vendor sends) must not crash — the role just can't resolve,
    // and the fallback rule applies as usual.
    const out = await resolveRecipients(neverClient, makeCouple(), {
      roles: ['me'],
      fallback: 'skip',
    })
    expect(out).toEqual([])
  })

  it('falls back to primary when "me" cannot resolve and fallback is primary_only', async () => {
    const out = await resolveRecipients(neverClient, makeCouple(), {
      roles: ['me'],
      fallback: 'primary_only',
    })
    expect(out).toHaveLength(1)
    expect(out[0]!.role).toBe('primary')
    expect(out[0]!.fallbackApplied).toBe(true)
  })
})

describe('resolveRecipients — existing roles still resolve', () => {
  it('primary resolves from the couple email', async () => {
    const out = await resolveRecipients(neverClient, makeCouple(), {
      roles: ['primary'],
      fallback: 'skip',
    })
    expect(out).toHaveLength(1)
    expect(out[0]!.email).toBe('sarah@example.com')
  })

  it('spouse without an email or phone is dropped', async () => {
    const out = await resolveRecipients(neverClient, makeCouple(), {
      roles: ['spouse'],
      fallback: 'skip',
    })
    expect(out).toEqual([])
  })
})

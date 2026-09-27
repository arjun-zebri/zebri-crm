import { NextRequest } from 'next/server'
import { afterAll, describe, expect, it, vi } from 'vitest'

/**
 * `POST /api/unsubscribe` end to end against local Supabase (Phase 2, Task
 * 11). Drives the route handler directly, admin client mocked to the local
 * service-role client (same pattern as `tests/integration/lead-capture/route.test.ts`).
 *
 * Proves the three behaviours the brief calls out:
 *   1. a valid token records the suppression and flips `couples.do_not_email`
 *      for every couple of that owner sharing the address (not just the one
 *      named in the token, since suppression is a property of the address);
 *   2. a tampered token is rejected, writes nothing, and is counted by the
 *      shared invalid-token limiter;
 *   3. a second confirm on an already-suppressed address is a no-op, not an
 *      error, since the unique index absorbs the repeat.
 *
 * `vi.mock` calls are hoisted by vitest above every import regardless of
 * source position, so `serviceClient` below is available inside the mock
 * factory despite being imported after it textually: same layout as
 * `tests/integration/lead-capture/route.test.ts`.
 */
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => serviceClient()),
}))

import { POST } from '@/app/api/unsubscribe/route'
// eslint-disable-next-line import/order
import { createUnsubscribeToken } from '@/lib/email/unsubscribe-token'
import { createTestUser, serviceClient } from '../helpers/supabase'

const pro = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
}

const cleanup: Array<() => Promise<void>> = []
afterAll(async () => {
  await Promise.all(cleanup.map((f) => f().catch(() => undefined)))
})

/** A fresh IP per call so tests never trip each other's rate-limit bucket. */
function randomIp(): string {
  return `10.77.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
}

function formReq(token: string, ip = randomIp()): NextRequest {
  const form = new FormData()
  form.set('token', token)
  return new NextRequest('http://localhost/api/unsubscribe', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
    body: form,
  })
}

async function makeCouple(userId: string, email: string): Promise<string> {
  const { data, error } = await serviceClient()
    .from('couples')
    .insert({ user_id: userId, name: 'Jamie & Alex', status: 'new', email })
    .select('id')
    .single()
  if (error) throw error
  return data!.id
}

describe('POST /api/unsubscribe', () => {
  it('a valid token records the suppression and flips couples.do_not_email', async () => {
    const user = await createTestUser({}, pro)
    cleanup.push(user.cleanup)
    const email = 'couple-valid@zebri.test'
    const coupleId = await makeCouple(user.id, email)
    const token = createUnsubscribeToken({ userId: user.id, coupleId, email })

    const res = await POST(formReq(token))
    expect(res.status).toBe(303)
    const location = res.headers.get('location') ?? ''
    expect(location).toContain(`/unsubscribe/${encodeURIComponent(token)}`)
    expect(location).not.toContain('error=')

    const admin = serviceClient()
    const { data: suppression } = await admin
      .from('email_suppression')
      .select('reason')
      .eq('user_id', user.id)
      .ilike('email', email)
      .maybeSingle()
    expect(suppression?.reason).toBe('unsubscribed')

    const { data: couple } = await admin
      .from('couples')
      .select('do_not_email, do_not_email_at')
      .eq('id', coupleId)
      .single()
    expect(couple?.do_not_email).toBe(true)
    expect(couple?.do_not_email_at).not.toBeNull()
  })

  it('flips do_not_email on every couple of that owner sharing the address, not just the one in the token', async () => {
    const user = await createTestUser({}, pro)
    cleanup.push(user.cleanup)
    const email = 'shared-address@zebri.test'
    const coupleA = await makeCouple(user.id, email)
    const coupleB = await makeCouple(user.id, email)
    // Token names coupleA; the write path still reaches coupleB because
    // suppression is keyed on the address, per the Task 10 migration.
    const token = createUnsubscribeToken({ userId: user.id, coupleId: coupleA, email })

    const res = await POST(formReq(token))
    expect(res.status).toBe(303)

    const { data } = await serviceClient()
      .from('couples')
      .select('id, do_not_email')
      .in('id', [coupleA, coupleB])
    expect(data?.every((c) => c.do_not_email)).toBe(true)
  })

  it('a tampered token is rejected: nothing is written, redirect carries error=invalid', async () => {
    const user = await createTestUser({}, pro)
    cleanup.push(user.cleanup)
    const email = 'couple-tampered@zebri.test'
    const coupleId = await makeCouple(user.id, email)
    const token = createUnsubscribeToken({ userId: user.id, coupleId, email })
    const parts = token.split('.')
    const payloadB64 = parts[0] ?? ''
    const sig = parts[1] ?? ''
    const flipped = sig.at(-1) === 'A' ? 'B' : 'A'
    const tampered = `${payloadB64}.${sig.slice(0, -1)}${flipped}`

    const res = await POST(formReq(tampered))
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('error=invalid')

    const { data, error } = await serviceClient()
      .from('email_suppression')
      .select('id')
      .eq('user_id', user.id)
      .ilike('email', email)
    expect(error).toBeNull()
    expect(data).toEqual([])

    const { data: couple } = await serviceClient()
      .from('couples')
      .select('do_not_email')
      .eq('id', coupleId)
      .single()
    expect(couple?.do_not_email).toBe(false)
  })

  it('a second confirm on an already-suppressed address is a harmless no-op', async () => {
    const user = await createTestUser({}, pro)
    cleanup.push(user.cleanup)
    const email = 'couple-repeat@zebri.test'
    const coupleId = await makeCouple(user.id, email)
    const token = createUnsubscribeToken({ userId: user.id, coupleId, email })
    const ip = randomIp()

    const first = await POST(formReq(token, ip))
    expect(first.status).toBe(303)
    expect(first.headers.get('location')).not.toContain('error=')

    const second = await POST(formReq(token, ip))
    expect(second.status).toBe(303)
    expect(second.headers.get('location')).not.toContain('error=')

    const { data } = await serviceClient()
      .from('email_suppression')
      .select('id')
      .eq('user_id', user.id)
      .ilike('email', email)
    // The unique index on (user_id, lower(email), reason) makes the repeat
    // insert a 23505, which the route treats as success rather than error:
    // still exactly one row, not two, not zero.
    expect(data).toHaveLength(1)
  })
})

describe('the couples.do_not_email flip matches the address, not a pattern (M1)', () => {
  it('an underscore in the address does not flip a same-tenant couple whose address differs at that position', async () => {
    const user = await createTestUser({}, pro)
    cleanup.push(user.cleanup)
    const email = 'john_smith@zebri.test'
    const coupleId = await makeCouple(user.id, email)
    // `_` is a single-character wildcard to ILIKE. Matched as a pattern,
    // this bystander's opt-out flag would be flipped by John's click.
    const bystander = await makeCouple(user.id, 'johnXsmith@zebri.test')
    const token = createUnsubscribeToken({ userId: user.id, coupleId, email })

    const res = await POST(formReq(token))
    expect(res.status).toBe(303)

    const { data } = await serviceClient()
      .from('couples')
      .select('id, do_not_email')
      .in('id', [coupleId, bystander])
    const flags = Object.fromEntries((data ?? []).map((c) => [c.id, c.do_not_email]))
    expect(flags[coupleId]).toBe(true)
    expect(flags[bystander]).toBe(false)
  })

  it('a stored address that differs only in case or surrounding space is still flipped', async () => {
    const user = await createTestUser({}, pro)
    cleanup.push(user.cleanup)
    const coupleId = await makeCouple(user.id, ' Mixed.Case@Zebri.test ')
    const token = createUnsubscribeToken({ userId: user.id, coupleId, email: 'mixed.case@zebri.test' })

    const res = await POST(formReq(token))
    expect(res.status).toBe(303)

    const { data } = await serviceClient().from('couples').select('do_not_email').eq('id', coupleId).single()
    expect(data?.do_not_email).toBe(true)
  })
})

describe('POST /api/unsubscribe rate limit (Task 15c: only invalid tokens are limited)', () => {
  // A valid token is never rate-limited: the write is idempotent and keyed
  // by the token's own address, and refusing it would drop a real opt-out
  // (Spam Act). Only invalid-token attempts are counted and refused.
  it('25 valid confirms from one IP inside a minute all succeed', async () => {
    const user = await createTestUser({}, pro)
    cleanup.push(user.cleanup)
    const email = 'couple-burst@zebri.test'
    const coupleId = await makeCouple(user.id, email)
    const token = createUnsubscribeToken({ userId: user.id, coupleId, email })
    const ip = randomIp()

    const locations: string[] = []
    for (let i = 0; i < 25; i++) {
      const res = await POST(formReq(token, ip))
      expect(res.status).toBe(303)
      locations.push(res.headers.get('location') ?? '')
    }
    expect(locations.filter((l) => l.includes('error='))).toEqual([])
  })

  it('a flood of invalid tokens from one IP is refused with error=rate_limited', async () => {
    const ip = randomIp()
    let last: Response | undefined
    for (let i = 0; i < 25; i++) {
      last = await POST(formReq(`not-a-token-${i}`, ip))
    }
    expect(last?.status).toBe(303)
    expect(last?.headers.get('location')).toContain('error=rate_limited')
  })
})

describe('POST /api/unsubscribe/[token] (RFC 8058 one-click) rate limit', () => {
  /** The one-click POST Gmail and Yahoo send, from one shared egress IP. */
  function oneClickReq(token: string, ip: string): NextRequest {
    return new NextRequest(`http://localhost/api/unsubscribe/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': ip },
      body: 'List-Unsubscribe=One-Click',
    })
  }

  it('25 valid one-click POSTs from one IP inside a minute all return 200', async () => {
    const { POST: oneClick } = await import('@/app/api/unsubscribe/[token]/route')
    const user = await createTestUser({}, pro)
    cleanup.push(user.cleanup)
    const ip = randomIp()

    // Distinct couples and addresses, as a provider's shared egress IP
    // would carry opt-outs from many different recipients.
    const statuses: number[] = []
    for (let i = 0; i < 25; i++) {
      const email = `oneclick-${i}@zebri.test`
      const coupleId = await makeCouple(user.id, email)
      const token = createUnsubscribeToken({ userId: user.id, coupleId, email })
      const res = await oneClick(oneClickReq(token, ip), { params: Promise.resolve({ token }) })
      statuses.push(res.status)
    }
    expect(statuses).toEqual(Array(25).fill(200))

    const { data } = await serviceClient().from('email_suppression').select('email').eq('user_id', user.id)
    expect(data).toHaveLength(25)
  })

  it('a flood of invalid tokens from one IP is still refused', async () => {
    const { POST: oneClick } = await import('@/app/api/unsubscribe/[token]/route')
    const ip = randomIp()
    const statuses: number[] = []
    for (let i = 0; i < 25; i++) {
      const token = `forged-${i}`
      const res = await oneClick(oneClickReq(token, ip), { params: Promise.resolve({ token }) })
      statuses.push(res.status)
    }
    expect(statuses.slice(0, 20)).toEqual(Array(20).fill(400))
    expect(statuses.slice(20)).toEqual(Array(5).fill(429))
  })
})

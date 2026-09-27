/**
 * `send_email` cc and bcc addresses on a commercial send (Task 15c).
 *
 * Before this task the cc list (`ccVendors`, `ccEmails`) and the typed
 * `bccEmails` rode as copies on every outgoing message. That broke the
 * Spam Act floor three ways: a cc'd vendor received the couple's copy
 * carrying the couple's unsubscribe link (and could unsubscribe the
 * couple with it), had no link of their own, and was never checked
 * against `email_suppression`. Each of those addresses is now its own
 * direct message, gated like any other recipient.
 *
 * Every case runs a real workflow step through the real executor against
 * the local database and inspects what reached the transport, modelled on
 * `tests/integration/email/legal-floor.test.ts`.
 */
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

let activeUser: TestUser | null = null

vi.mock('@/lib/email/dispatch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/dispatch')>()
  return { ...actual, dispatchEmail: vi.fn() }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user: set `activeUser` first')
    return activeUser.client
  }),
}))

import { dispatchEmail, type DispatchPayload } from '@/lib/email/dispatch'
import { advanceDueSteps } from '@/lib/workflows/executor'
import { applyTemplate } from '@/lib/workflows/instantiate'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'
import { seedEventTemplate } from '../helpers/workflows'

const dispatchMock = vi.mocked(dispatchEmail)

afterEach(() => {
  activeUser = null
  dispatchMock.mockReset()
})

/** Every payload that reached the transport, in order. */
function captureDispatches(): DispatchPayload[] {
  const captured: DispatchPayload[] = []
  dispatchMock.mockImplementation(async (_sender, payload) => {
    captured.push(payload)
    return { ok: true, messageId: `msg-${captured.length}` }
  })
  return captured
}

/** Normalise a to/cc/bcc field to a lower-cased address list. */
function addresses(field: string | string[] | undefined): string[] {
  if (!field) return []
  return (Array.isArray(field) ? field : [field]).map((e) => e.trim().toLowerCase())
}

/**
 * How many copies each address receives across every captured message,
 * counting `to`, `cc` and `bcc` alike: an address on the cc line of two
 * messages gets two emails.
 */
function deliveries(captured: DispatchPayload[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const p of captured) {
    for (const a of [...addresses(p.to), ...addresses(p.cc), ...addresses(p.bcc)]) {
      counts[a] = (counts[a] ?? 0) + 1
    }
  }
  return counts
}

/** The address a token was minted for, read from its (signed) payload. */
function tokenEmail(token: string): string {
  const payloadB64 = token.split('.')[0] ?? ''
  const json = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as { email: string }
  return json.email
}

/** The token at the end of an unsubscribe URL's path. */
function tokenOf(url: string): string {
  const last = new URL(url).pathname.split('/').pop() ?? ''
  return decodeURIComponent(last)
}

/** The token in the footer's `/unsubscribe/<token>` page link, or null. */
function footerToken(html: string): string | null {
  const m = html.match(/href="[^"]*\/unsubscribe\/([^"?]+)"/)
  return m?.[1] ? decodeURIComponent(m[1]) : null
}

function randomIp(): string {
  return `10.89.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
}

/** POST what an RFC 8058 mailbox provider sends to the advertised URL. */
async function oneClick(url: string): Promise<Response> {
  const mod = await import('@/app/api/unsubscribe/[token]/route')
  const req = new NextRequest(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-forwarded-for': randomIp(),
    },
    body: 'List-Unsubscribe=One-Click',
  })
  return mod.POST(req, { params: Promise.resolve({ token: tokenOf(url) }) })
}

async function seedCouple(userId: string, opts: { email: string; spouseEmail?: string }): Promise<string> {
  const { data, error } = await serviceClient()
    .from('couples')
    .insert({
      user_id: userId,
      name: 'Cc split couple',
      status: 'booked',
      email: opts.email,
      kanban_position: 0,
      ...(opts.spouseEmail ? { secondary_name: 'Sam', secondary_email: opts.spouseEmail } : {}),
    } as never)
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed couple: ${error?.message}`)
  return (data as { id: string }).id
}

async function seedVendor(userId: string, coupleId: string, email: string): Promise<void> {
  const svc = serviceClient()
  const { data: contact, error } = await svc
    .from('contacts')
    .insert({ user_id: userId, name: 'Flowers Co', email, category: 'florist' } as never)
    .select('id')
    .single()
  if (error || !contact) throw new Error(`seed contact: ${error?.message}`)
  const { error: linkErr } = await svc
    .from('couple_contacts')
    .insert({ user_id: userId, couple_id: coupleId, contact_id: (contact as { id: string }).id } as never)
  if (linkErr) throw new Error(`seed couple_contacts: ${linkErr.message}`)
}

async function seedSuppression(userId: string, email: string): Promise<void> {
  const { error } = await serviceClient()
    .from('email_suppression')
    .insert({ user_id: userId, email, reason: 'unsubscribed' } as never)
  if (error) throw new Error(`seed suppression: ${error.message}`)
}

/** Seed a one-step template, apply it to the couple, and run the tick. */
async function runStep(user: TestUser, coupleId: string, config: Record<string, unknown>) {
  const templateId = await seedEventTemplate(user.id, 'couple.created')
  const { error } = await serviceClient().from('workflow_template_steps').insert({
    template_id: templateId,
    type: 'action',
    position: 0,
    parent_step_id: null,
    config,
  } as never)
  if (error) throw new Error(`seed step: ${error.message}`)
  activeUser = user
  await applyTemplate(serviceClient(), { userId: user.id, templateId, coupleId })
  await advanceDueSteps(serviceClient())

  const svc = serviceClient()
  const { data: instances } = await svc.from('workflow_instances').select('id').eq('template_id', templateId)
  if (instances?.length !== 1) throw new Error(`expected one instance, got ${instances?.length ?? 0}`)
  const { data: steps } = await svc
    .from('workflow_steps')
    .select('status, output, error_message')
    .eq('instance_id', instances[0]!.id)
  if (steps?.length !== 1) throw new Error(`expected one step, got ${steps?.length ?? 0}`)
  return steps[0]!
}

async function suppressedAddresses(userId: string): Promise<string[]> {
  const { data, error } = await serviceClient()
    .from('email_suppression')
    .select('email')
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => r.email.toLowerCase()).sort()
}

const inlineSend = (roles: string[], extra: Record<string, unknown>) => ({
  actionType: 'send_email',
  recipients: { roles, fallback: 'skip' },
  subject: 'Checking in',
  body: 'Hi there',
  ...extra,
})

describe('send_email: a cc or bcc address on a commercial send is its own recipient', () => {
  it("a cc'd vendor gets their own message whose link suppresses the vendor, not the couple; the couple's copy has no cc", async () => {
    const user = await createTestUser()
    const coupleId = await seedCouple(user.id, { email: 'cc-primary@example.com' })
    await seedVendor(user.id, coupleId, 'cc-florist@example.com')
    const captured = captureDispatches()

    const step = await runStep(user, coupleId, inlineSend(['primary'], { ccVendors: true }))
    expect(step.status).toBe('done')

    const byTo = new Map(captured.map((p) => [addresses(p.to).join(','), p]))
    expect([...byTo.keys()].sort()).toEqual(['cc-florist@example.com', 'cc-primary@example.com'])

    const coupleCopy = byTo.get('cc-primary@example.com')!
    expect(addresses(coupleCopy.cc)).toEqual([])

    const vendorCopy = byTo.get('cc-florist@example.com')!
    expect(tokenEmail(tokenOf(vendorCopy.listUnsubscribeUrl!))).toBe('cc-florist@example.com')
    expect(tokenEmail(footerToken(vendorCopy.html)!)).toBe('cc-florist@example.com')
    // Separate idempotency keys: one key for both would make Resend
    // collapse the vendor's message into the couple's.
    expect(vendorCopy.idempotencyKey).toBeTruthy()
    expect(vendorCopy.idempotencyKey).not.toBe(coupleCopy.idempotencyKey)

    const res = await oneClick(vendorCopy.listUnsubscribeUrl!)
    expect(res.status).toBe(200)
    expect(await suppressedAddresses(user.id)).toEqual(['cc-florist@example.com'])
    const { data: couple } = await serviceClient()
      .from('couples')
      .select('do_not_email')
      .eq('id', coupleId)
      .single()
    expect(couple?.do_not_email).toBe(false)

    await user.cleanup()
  })

  it('a cc address already in email_suppression receives nothing, and the rest of the step still sends', async () => {
    const user = await createTestUser()
    const coupleId = await seedCouple(user.id, { email: 'sup-primary@example.com' })
    await seedSuppression(user.id, 'gone@example.com')
    const captured = captureDispatches()

    const step = await runStep(
      user,
      coupleId,
      inlineSend(['primary'], { ccEmails: ['gone@example.com', 'planner@example.com'] }),
    )
    expect(step.status).toBe('done')

    const counts = deliveries(captured)
    expect(counts['gone@example.com']).toBeUndefined()
    expect(counts['sup-primary@example.com']).toBe(1)
    expect(counts['planner@example.com']).toBe(1)
    expect(step.output).toMatchObject({ sent: 2, suppressed: 1 })

    await user.cleanup()
  })

  it('an address that is both a direct recipient and in ccEmails or bccEmails gets exactly one message', async () => {
    const user = await createTestUser()
    const coupleId = await seedCouple(user.id, {
      email: 'dup-primary@example.com',
      spouseEmail: 'dup-spouse@example.com',
    })
    const captured = captureDispatches()

    await runStep(
      user,
      coupleId,
      inlineSend(['primary', 'spouse'], {
        ccEmails: ['DUP-Primary@example.com', 'dup-planner@example.com'],
        bccEmails: ['dup-spouse@example.com', 'dup-planner@example.com'],
      }),
    )

    expect(deliveries(captured)).toEqual({
      'dup-primary@example.com': 1,
      'dup-spouse@example.com': 1,
      'dup-planner@example.com': 1,
    })

    await user.cleanup()
  })
})

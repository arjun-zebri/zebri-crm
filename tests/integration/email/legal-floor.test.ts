/**
 * The email legal floor end to end (Phase 2 whole-phase fix wave).
 *
 * Every case here runs a real workflow step through the real executor
 * against the local database, captures what reached the transport, and
 * then acts on it the way a mailbox provider or a recipient would. The
 * per-task tests checked that a header existed and that the primary's
 * token worked; the two Critical findings lived in the seams those
 * checks could not see:
 *
 * - C1: the URL in `List-Unsubscribe` has to accept the RFC 8058
 *   one-click POST. The test POSTs exactly what Gmail sends
 *   (`List-Unsubscribe=One-Click`, form-urlencoded, no cookie) to exactly
 *   the URL the header carried, then reads the suppression table.
 * - C2: each recipient's link has to unsubscribe that recipient. The
 *   test decodes the token each copy carried and clicks the spouse's.
 *
 * The rest pin the Important findings: which sends carry the floor (I1)
 * and whose opt-out stops whose mail (I2).
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
  return `10.88.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
}

/**
 * POST what an RFC 8058 mailbox provider sends: the one-click body,
 * form-urlencoded, no cookie, to the exact URL the header advertised.
 */
async function oneClick(url: string): Promise<Response> {
  const pathname = new URL(url).pathname
  // The header has to name a route handler. A page cannot take this POST:
  // Next renders it and writes nothing, which is the C1 failure.
  expect(pathname).toMatch(/^\/api\/unsubscribe\/[^/]+$/)
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

interface SeededCouple {
  coupleId: string
}

async function seedCouple(
  userId: string,
  opts: { email: string; spouseEmail?: string; doNotEmail?: boolean },
): Promise<SeededCouple> {
  const { data, error } = await serviceClient()
    .from('couples')
    .insert({
      user_id: userId,
      name: 'Legal floor couple',
      status: 'booked',
      email: opts.email,
      kanban_position: 0,
      do_not_email: opts.doNotEmail ?? false,
      ...(opts.spouseEmail ? { secondary_name: 'Sam', secondary_email: opts.spouseEmail } : {}),
    } as never)
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed couple: ${error?.message}`)
  return { coupleId: (data as { id: string }).id }
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

async function seedEvent(userId: string, coupleId: string): Promise<void> {
  const { error } = await serviceClient()
    .from('events')
    .insert({ user_id: userId, couple_id: coupleId, title: 'Wedding', date: '2027-03-01' } as never)
  if (error) throw new Error(`seed event: ${error.message}`)
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
  return onlyStep(templateId)
}

async function onlyStep(templateId: string): Promise<{ status: string; output: unknown; error_message: string | null }> {
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

const inlineSend = (roles: string[]) => ({
  actionType: 'send_email',
  recipients: { roles, fallback: 'skip' },
  subject: 'Checking in',
  body: 'Hi there',
})

describe('C1: the List-Unsubscribe URL accepts the RFC 8058 one-click POST', () => {
  it('records the suppression when Gmail POSTs List-Unsubscribe=One-Click to the advertised URL', async () => {
    const user = await createTestUser()
    const { coupleId } = await seedCouple(user.id, { email: 'oneclick@example.com' })
    const captured = captureDispatches()

    await runStep(user, coupleId, inlineSend(['primary']))

    expect(captured).toHaveLength(1)
    const header = captured[0]!.listUnsubscribeUrl
    expect(header).toBeTruthy()

    const res = await oneClick(header!)
    expect(res.status).toBe(200)

    expect(await suppressedAddresses(user.id)).toEqual(['oneclick@example.com'])
    const { data: couple } = await serviceClient()
      .from('couples')
      .select('do_not_email')
      .eq('id', coupleId)
      .single()
    expect(couple?.do_not_email).toBe(true)

    await user.cleanup()
  })

  it('a GET to the advertised URL never writes and hands the person the page', async () => {
    const user = await createTestUser()
    const { coupleId } = await seedCouple(user.id, { email: 'prefetch@example.com' })
    const captured = captureDispatches()

    await runStep(user, coupleId, inlineSend(['primary']))
    const header = captured[0]!.listUnsubscribeUrl!

    const mod = await import('@/app/api/unsubscribe/[token]/route')
    const res = await mod.GET(new NextRequest(header, { method: 'GET' }), {
      params: Promise.resolve({ token: tokenOf(header) }),
    })
    expect(res.status).toBe(303)
    expect(new URL(res.headers.get('location')!).pathname).toBe(
      `/unsubscribe/${encodeURIComponent(tokenOf(header))}`,
    )
    expect(await suppressedAddresses(user.id)).toEqual([])

    await user.cleanup()
  })
})

describe('C2: every recipient gets a link that unsubscribes that recipient', () => {
  it("the spouse's link suppresses the spouse and not the primary; the vendor's copy never names the couple", async () => {
    const user = await createTestUser()
    const { coupleId } = await seedCouple(user.id, {
      email: 'primary@example.com',
      spouseEmail: 'spouse@example.com',
    })
    await seedVendor(user.id, coupleId, 'florist@example.com')
    const captured = captureDispatches()

    await runStep(user, coupleId, inlineSend(['primary', 'spouse', 'vendor']))

    const byTo = new Map(captured.map((p) => [String(p.to).toLowerCase(), p]))
    expect([...byTo.keys()].sort()).toEqual([
      'florist@example.com',
      'primary@example.com',
      'spouse@example.com',
    ])
    for (const [to, payload] of byTo) {
      expect(tokenEmail(tokenOf(payload.listUnsubscribeUrl!)), `header token for ${to}`).toBe(to)
      expect(tokenEmail(footerToken(payload.html)!), `footer token for ${to}`).toBe(to)
    }
    const vendorHtml = byTo.get('florist@example.com')!.html
    expect(vendorHtml).not.toContain('primary@example.com')

    const res = await oneClick(byTo.get('spouse@example.com')!.listUnsubscribeUrl!)
    expect(res.status).toBe(200)
    expect(await suppressedAddresses(user.id)).toEqual(['spouse@example.com'])
    // The spouse is not the couple's own stored address, so the couple
    // row is untouched: the primary keeps receiving.
    const { data: couple } = await serviceClient()
      .from('couples')
      .select('do_not_email')
      .eq('id', coupleId)
      .single()
    expect(couple?.do_not_email).toBe(false)

    await user.cleanup()
  })

  it('a recipient on a couple with no email of its own still gets their own link', async () => {
    const user = await createTestUser()
    const { coupleId } = await seedCouple(user.id, { email: '', spouseEmail: 'only-spouse@example.com' })
    const captured = captureDispatches()

    await runStep(user, coupleId, inlineSend(['spouse']))

    expect(captured).toHaveLength(1)
    expect(tokenEmail(tokenOf(captured[0]!.listUnsubscribeUrl!))).toBe('only-spouse@example.com')
    expect(tokenEmail(footerToken(captured[0]!.html)!)).toBe('only-spouse@example.com')

    await user.cleanup()
  })
})

describe('I1: every commercial automated send carries the floor and honours the opt-out', () => {
  it('request_information carries the header and the footer link, and the one-click works', async () => {
    const user = await createTestUser()
    const { coupleId } = await seedCouple(user.id, { email: 'reqinfo@example.com' })
    const captured = captureDispatches()

    await runStep(user, coupleId, { actionType: 'request_information', section: 'songs' })

    expect(captured).toHaveLength(1)
    const payload = captured[0]!
    expect(tokenEmail(footerToken(payload.html)!)).toBe('reqinfo@example.com')
    const res = await oneClick(payload.listUnsubscribeUrl!)
    expect(res.status).toBe(200)
    expect(await suppressedAddresses(user.id)).toEqual(['reqinfo@example.com'])

    await user.cleanup()
  })

  it('the questionnaire never reaches an unsubscribed couple, and creates nothing for them', async () => {
    const user = await createTestUser()
    const { coupleId } = await seedCouple(user.id, { email: 'q-suppressed@example.com' })
    await seedSuppression(user.id, 'q-suppressed@example.com')
    const { data: tpl, error } = await serviceClient()
      .from('questionnaire_templates')
      .insert({ user_id: user.id, name: 'Getting to know you', questions: [] } as never)
      .select('id')
      .single()
    if (error || !tpl) throw new Error(`seed questionnaire: ${error?.message}`)
    const captured = captureDispatches()

    const step = await runStep(user, coupleId, {
      actionType: 'send_couple_questionnaire',
      questionnaireTemplateId: (tpl as { id: string }).id,
    })

    expect(captured).toHaveLength(0)
    expect(step.status).toBe('done')
    const { data: rows } = await serviceClient()
      .from('couple_questionnaires')
      .select('id')
      .eq('couple_id', coupleId)
    expect(rows).toEqual([])

    await user.cleanup()
  })

  it('the questionnaire to a clear couple carries the floor and the tenant tag', async () => {
    const user = await createTestUser()
    const { coupleId } = await seedCouple(user.id, { email: 'q-clear@example.com' })
    const { data: tpl, error } = await serviceClient()
      .from('questionnaire_templates')
      .insert({ user_id: user.id, name: 'Getting to know you', questions: [] } as never)
      .select('id')
      .single()
    if (error || !tpl) throw new Error(`seed questionnaire: ${error?.message}`)
    const captured = captureDispatches()

    await runStep(user, coupleId, {
      actionType: 'send_couple_questionnaire',
      questionnaireTemplateId: (tpl as { id: string }).id,
    })

    expect(captured).toHaveLength(1)
    const payload = captured[0]!
    expect(payload.tags).toContainEqual({ name: 'tenant', value: user.id })
    expect(tokenEmail(tokenOf(payload.listUnsubscribeUrl!))).toBe('q-clear@example.com')
    expect(tokenEmail(footerToken(payload.html)!)).toBe('q-clear@example.com')

    await user.cleanup()
  })

  it('the run sheet never reaches an unsubscribed couple, while the MC still gets their copy', async () => {
    const user = await createTestUser()
    const { coupleId } = await seedCouple(user.id, { email: 'rs-suppressed@example.com' })
    await seedEvent(user.id, coupleId)
    await seedSuppression(user.id, 'rs-suppressed@example.com')
    const captured = captureDispatches()

    await runStep(user, coupleId, { actionType: 'generate_run_sheet_pdf', sendToCouple: true })

    const recipients = captured.flatMap((p) => (Array.isArray(p.to) ? p.to : [p.to]))
    expect(recipients).not.toContain('rs-suppressed@example.com')
    expect(recipients).toContain(user.email)

    await user.cleanup()
  })
})

describe("I2: a couple's opt-out does not silence their vendors", () => {
  it('the run sheet still reaches the vendors of an opted-out couple, and the step says so', async () => {
    const user = await createTestUser()
    const { coupleId } = await seedCouple(user.id, { email: 'optedout@example.com', doNotEmail: true })
    await seedEvent(user.id, coupleId)
    await seedVendor(user.id, coupleId, 'venue@example.com')
    const captured = captureDispatches()

    const step = await runStep(user, coupleId, {
      actionType: 'send_timeline_to_vendors',
      sendToVendors: true,
      sendToCouple: true,
    })

    expect(captured.map((p) => p.to)).toEqual(['venue@example.com'])
    const output = step.output as { sent?: number; skipped?: number } | null
    expect(output?.sent).toBe(1)
    expect(output?.skipped).toBe(1)

    await user.cleanup()
  })

  it('a suppressed vendor is counted as skipped, not as sent', async () => {
    const user = await createTestUser()
    const { coupleId } = await seedCouple(user.id, { email: 'happy@example.com' })
    await seedEvent(user.id, coupleId)
    await seedVendor(user.id, coupleId, 'gone-vendor@example.com')
    await seedSuppression(user.id, 'gone-vendor@example.com')
    const captured = captureDispatches()

    const step = await runStep(user, coupleId, {
      actionType: 'send_timeline_to_vendors',
      sendToVendors: true,
    })

    expect(captured).toHaveLength(0)
    expect(step.status).toBe('done')
    const output = step.output as { sent?: number; skipped?: number } | null
    expect(output?.sent).toBe(0)
    expect(output?.skipped).toBe(1)

    await user.cleanup()
  })
})

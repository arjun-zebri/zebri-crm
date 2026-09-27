/**
 * The step envelope under real RLS (Task 29).
 *
 * The envelope reads the MC's suppression list, sending settings and
 * timezone through their own client, so these prove three things only a
 * real database can: a suppressed address shows as skipped (the
 * security-invoker suppression function answers for the caller), another
 * MC's suppression of the same address changes nothing (tenant scoping),
 * and building it writes nothing at all.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

let activeUser: TestUser | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user, set `activeUser` first')
    return activeUser.client
  }),
}))

// eslint-disable-next-line import/order
import { loadStepDetailAction, previewStepAction } from '@/app/(dashboard)/workflows/instance-actions'

const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const admin = serviceClient()

let owner: TestUser
let other: TestUser

beforeAll(async () => {
  owner = await createTestUser({}, PRO)
  other = await createTestUser({}, PRO)
  const settings = await owner.client.from('user_public_settings').upsert(
    {
      user_id: owner.id,
      subdomain: `env-${owner.id.slice(0, 8)}`,
      email_mode: 'zebri',
      timezone: 'Australia/Perth',
    } as never,
    { onConflict: 'user_id' },
  )
  expect(settings.error).toBeNull()
})

afterEach(() => {
  activeUser = null
})

/** A couple with two partner addresses, and one held send step. */
async function seed(tag: string, config: Record<string, unknown>, dueAt: string) {
  const primary = `p-${tag}@envelope.test`
  const spouse = `s-${tag}@envelope.test`
  const { data: couple, error: coupleErr } = await admin
    .from('couples')
    .insert({
      user_id: owner.id,
      name: `Envelope ${tag}`,
      status: 'Enquiry',
      primary_email: primary,
      secondary_email: spouse,
      secondary_name: 'Jo',
    } as never)
    .select('id')
    .single()
  if (coupleErr) throw new Error(coupleErr.message)
  const coupleId = (couple as { id: string }).id

  const { data: instance, error: instErr } = await admin
    .from('workflow_instances')
    .insert({ user_id: owner.id, couple_id: coupleId, name: 'Env flow', status: 'active' } as never)
    .select('id')
    .single()
  if (instErr) throw new Error(instErr.message)

  const { data: step, error: stepErr } = await admin
    .from('workflow_steps')
    .insert({
      instance_id: (instance as { id: string }).id,
      position: 0,
      type: 'action',
      title: 'Held send',
      config: { actionType: 'send_email', ...config },
      status: 'pending',
      requires_approval: true,
      due_at: dueAt,
      timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
    } as never)
    .select('id')
    .single()
  if (stepErr) throw new Error(stepErr.message)
  return { coupleId, stepId: (step as { id: string }).id, primary, spouse }
}

const BODY = {
  subject: 'Hello',
  body: 'Plain words at {{venue.name}}',
  recipients: { roles: ['primary', 'spouse'], fallback: 'primary_only' },
  bccSelf: true,
  replyToOverride: 'bookings@envelope.test',
}

describe('the step envelope', () => {
  it('shows a suppressed partner as skipped, the MC’s copy, reply-to and a Perth time', async () => {
    const future = '2099-03-10T08:00:00Z'
    const { stepId, primary, spouse } = await seed('a', BODY, future)
    const sup = await admin
      .from('email_suppression')
      .insert({ user_id: owner.id, email: spouse, reason: 'unsubscribed' } as never)
    expect(sup.error).toBeNull()

    activeUser = owner
    const res = await loadStepDetailAction({ stepId })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const envelope = res.data.preview?.envelope
    expect(envelope).toBeDefined()
    expect(envelope!.to).toEqual([
      expect.objectContaining({ email: primary, skipped: null, copy: false }),
      expect.objectContaining({ email: spouse, skipped: 'suppressed', copy: false }),
    ])
    expect(envelope!.mcCopy).toBe(owner.email)
    expect(envelope!.replyTo).toBe('bookings@envelope.test')
    expect(envelope!.via).toBe('zebri')
    // 08:00 UTC is 4:00 pm in Perth, the MC's saved zone.
    expect(envelope!.sendAt).toMatchObject({ kind: 'at', timeZone: 'Australia/Perth' })
    if (envelope!.sendAt?.kind === 'at') expect(envelope!.sendAt.label).toMatch(/4:00\s?pm/i)
    // Legacy text: the gap is listed and marked in the preview.
    expect(envelope!.unresolved).toEqual(['Venue name'])
    expect(res.data.preview?.html).toContain('data-missing-var="true"')
  })

  it('ignores another MC’s suppression of the same address', async () => {
    const { stepId, spouse } = await seed('b', BODY, new Date(Date.now() - 60_000).toISOString())
    const sup = await admin
      .from('email_suppression')
      .insert({ user_id: other.id, email: spouse, reason: 'unsubscribed' } as never)
    expect(sup.error).toBeNull()

    activeUser = owner
    const res = await previewStepAction({ stepId })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data.envelope?.to.every((r) => r.skipped === null)).toBe(true)
    expect(res.data.envelope?.sendAt).toEqual({ kind: 'now' })
  })

  it('writes nothing: no send record, no suppression row, no settings change', async () => {
    const { coupleId, stepId } = await seed('c', BODY, new Date(Date.now() - 60_000).toISOString())
    const count = async (table: 'couple_emails' | 'email_suppression') =>
      (
        await admin
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq(table === 'couple_emails' ? 'couple_id' : 'user_id', table === 'couple_emails' ? coupleId : owner.id)
      ).count
    const before = {
      emails: await count('couple_emails'),
      suppression: await count('email_suppression'),
      settings: (await admin.from('user_public_settings').select('updated_at').eq('user_id', owner.id).single()).data,
    }

    activeUser = owner
    expect((await previewStepAction({ stepId })).ok).toBe(true)
    expect((await previewStepAction({ stepId, edits: { subject: 'S', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Edited' }] }] } } })).ok).toBe(true)

    expect(await count('couple_emails')).toBe(before.emails)
    expect(await count('email_suppression')).toBe(before.suppression)
    expect(
      (await admin.from('user_public_settings').select('updated_at').eq('user_id', owner.id).single()).data,
    ).toEqual(before.settings)
  })
})

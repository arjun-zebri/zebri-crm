/**
 * The Start preview's server action (Phase 3, Task 20).
 *
 * `previewApplyAction` shows the MC a workflow's calendar for one couple
 * before it starts. It runs under the caller's own RLS client, so these
 * prove it cannot read another MC's workflow or couple, that it writes
 * nothing, and that the rows it flags as skipped are exactly the rows
 * the real apply then skips.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

let activeUser: TestUser | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user; set `activeUser` first')
    return activeUser.client
  }),
}))

// eslint-disable-next-line import/order
import {
  applyTemplateToCoupleAction,
  previewApplyAction,
} from '@/app/(dashboard)/workflows/instance-actions'

const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const DAY = 86_400_000
const admin = serviceClient()

let owner: TestUser
let attacker: TestUser

beforeAll(async () => {
  owner = await createTestUser({}, PRO)
  attacker = await createTestUser({}, PRO)
})

afterEach(() => {
  activeUser = null
})

afterAll(async () => {
  await owner.cleanup()
  await attacker.cleanup()
})

/** `YYYY-MM-DD`, `days` from today. */
const dateIn = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10)

async function seedCouple(user: TestUser, name: string, eventDate: string | null) {
  const { data, error } = await admin
    .from('couples')
    .insert({
      user_id: user.id,
      name,
      status: 'Enquiry',
      email: 'preview@example.com',
      ...(eventDate ? { event_date: eventDate } : {}),
    } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

const before = (amount: number, unit: 'weeks' | 'months') => ({
  mode: 'wedding_relative',
  direction: 'before',
  amount,
  unit,
})

/** The plan's case: six months, three months and one week out. */
async function seedTemplate(user: TestUser, name: string) {
  const { data, error } = await admin
    .from('workflow_templates')
    .insert({ user_id: user.id, name, status: 'active', quiet_hours_start: null, quiet_hours_end: null } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const templateId = (data as { id: string }).id
  const steps = [
    ['Six months out', before(6, 'months')],
    ['Three months out', before(3, 'months')],
    ['A week out', before(1, 'weeks')],
  ] as const
  const { error: stepErr } = await admin.from('workflow_template_steps').insert(
    steps.map(([title, timing], i) => ({
      template_id: templateId,
      position: i,
      type: 'action',
      title,
      config: { actionType: 'send_email', recipients: { roles: ['primary'], fallback: 'skip' }, subject: title, body: 'Hi' },
      timing,
      parent_step_id: null,
      branch_path: null,
    })) as never,
  )
  if (stepErr) throw new Error(stepErr.message)
  return templateId
}

/** Rows this MC owns in the tables an apply writes. */
async function footprint(user: TestUser) {
  const count = async (table: 'workflow_instances' | 'workflow_audit_log') => {
    const { count: n } = await admin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
    return n ?? 0
  }
  return { instances: await count('workflow_instances'), audit: await count('workflow_audit_log') }
}

describe('previewApplyAction', () => {
  it('flags the steps already past, three weeks out, and writes nothing', async () => {
    const coupleId = await seedCouple(owner, 'Preview Close', dateIn(21))
    const templateId = await seedTemplate(owner, 'Preview Long Flow')
    const beforeRun = await footprint(owner)

    activeUser = owner
    const res = await previewApplyAction({ templateId, coupleId })
    if (!res.ok) throw new Error(res.error)

    expect(res.data.templateName).toBe('Preview Long Flow')
    expect(res.data.rows.map((r) => [r.title, r.flag])).toEqual([
      ['Six months out', 'skipped_past'],
      ['Three months out', 'skipped_past'],
      ['A week out', 'scheduled'],
    ])
    expect(await footprint(owner)).toEqual(beforeRun)
  })

  it('flags exactly the steps the real apply then skips', async () => {
    const coupleId = await seedCouple(owner, 'Preview Agree', dateIn(21))
    const templateId = await seedTemplate(owner, 'Preview Agree Flow')

    activeUser = owner
    const preview = await previewApplyAction({ templateId, coupleId })
    if (!preview.ok) throw new Error(preview.error)
    const applied = await applyTemplateToCoupleAction({ templateId, coupleId, force: false })
    if (!applied.ok) throw new Error(applied.error)

    const { data: steps } = await admin
      .from('workflow_steps')
      .select('title, status')
      .eq('instance_id', applied.data.instanceId)
    const skipped = (steps ?? []).filter((s) => s.status === 'skipped').map((s) => s.title).sort()
    const flagged = preview.data.rows.filter((r) => r.flag === 'skipped_past').map((r) => r.title).sort()
    expect(flagged).toEqual(['Six months out', 'Three months out'])
    expect(skipped).toEqual(flagged)
  })

  it('says wedding-dated steps wait when the couple has no wedding date', async () => {
    const coupleId = await seedCouple(owner, 'Preview Undated', null)
    const templateId = await seedTemplate(owner, 'Preview Undated Flow')

    activeUser = owner
    const res = await previewApplyAction({ templateId, coupleId })
    if (!res.ok) throw new Error(res.error)
    expect(res.data.weddingDate).toBeNull()
    expect(res.data.rows.map((r) => [r.flag, r.date])).toEqual([
      ['needs_wedding_date', null],
      ['needs_wedding_date', null],
      ['needs_wedding_date', null],
    ])
  })

  it("will not preview another MC's workflow, even on the caller's own couple", async () => {
    const templateId = await seedTemplate(owner, 'Preview Private Flow')
    const theirCouple = await seedCouple(attacker, 'Attacker Couple', dateIn(21))

    activeUser = attacker
    const res = await previewApplyAction({ templateId, coupleId: theirCouple })
    expect(res.ok).toBe(false)
  })

  it("will not preview on another MC's couple, even with the caller's own workflow", async () => {
    const ownerCouple = await seedCouple(owner, 'Owner Couple', dateIn(21))
    const theirTemplate = await seedTemplate(attacker, 'Attacker Flow')
    const beforeRun = await footprint(owner)

    activeUser = attacker
    const res = await previewApplyAction({ templateId: theirTemplate, coupleId: ownerCouple })
    expect(res.ok).toBe(false)
    expect(await footprint(owner)).toEqual(beforeRun)
  })

  it('refuses input that is not two ids', async () => {
    activeUser = owner
    const res = await previewApplyAction({ templateId: 'nope', coupleId: 'nope' })
    expect(res.ok).toBe(false)
  })
})

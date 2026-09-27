/**
 * A Wait has one number (wait card simplification).
 *
 * A Wait used to carry the generic start offset as well as its own
 * duration, and the engine waited for both. The data fix
 * `20261024500000_workflow_wait_single_delay.sql` folds the offset into
 * the duration on template steps and on live steps that have not been
 * dated yet, so the total delay is unchanged, and clears the review
 * flag. A live step that is already dated or already asleep is left
 * exactly as it is. The builder save applies the same rule to anything
 * written from now on.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import type { Database, Json } from '@/types/database'

import { runSql } from '../helpers/sql'
import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

let activeUser: TestUser | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user: set activeUser first')
    return activeUser.client
  }),
}))

// eslint-disable-next-line import/order
import { upsertTemplateStepRow } from '@/app/(dashboard)/workflows/actions'

const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const PAST = '2026-01-01T00:00:00.000Z'
const FUTURE = '2099-01-01T00:00:00.000Z'
const DAY = 60 * 24
const WAIT_TIMING = { mode: 'after_previous', delayAmount: 0, unit: 'days' }
const MIGRATION = 'supabase/migrations/20261024500000_workflow_wait_single_delay.sql'

type StepRow = { config: Record<string, unknown>; timing: Record<string, unknown>; requires_approval: boolean }

const MINUTES: Record<string, number> = { minutes: 1, hours: 60, days: DAY }

/** Start offset plus duration: the whole delay a duration Wait adds. */
function totalDelay(step: StepRow): number {
  const offset =
    step.timing['mode'] === 'after_previous'
      ? Number(step.timing['delayAmount']) * MINUTES[String(step.timing['unit'])]!
      : 0
  return offset + Number(step.config['durationMinutes'])
}

function applyMigration(): void {
  runSql(readFileSync(join(process.cwd(), MIGRATION), 'utf8'))
}

describe('a Wait has one number', () => {
  const admin = serviceClient()
  let user: TestUser
  let templateId: string
  let instanceId: string

  beforeAll(async () => {
    user = await createTestUser({}, PRO)
    const { data: template, error } = await admin
      .from('workflow_templates')
      .insert({ user_id: user.id, name: 'Wait fold', status: 'draft', apply_rule_type: 'manual', apply_rule_config: {} })
      .select('id')
      .single()
    expect(error).toBeNull()
    templateId = template!.id
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Wait Fold Couple', status: 'Enquiry' })
      .select('id')
      .single()
    const { data: instance, error: instanceError } = await admin
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name: 'Wait fold', applied_at: PAST })
      .select('id')
      .single()
    expect(instanceError).toBeNull()
    instanceId = instance!.id
  })

  afterEach(() => {
    activeUser = null
  })

  afterAll(async () => {
    await user?.cleanup()
  })

  async function templateStep(
    row: Omit<Database['public']['Tables']['workflow_template_steps']['Insert'], 'template_id'>,
  ): Promise<string> {
    const { data, error } = await admin
      .from('workflow_template_steps')
      .insert({ template_id: templateId, ...row })
      .select('id')
      .single()
    expect(error).toBeNull()
    return data!.id
  }

  async function instanceStep(
    row: Omit<Database['public']['Tables']['workflow_steps']['Insert'], 'instance_id'>,
  ): Promise<string> {
    const { data, error } = await admin
      .from('workflow_steps')
      .insert({ instance_id: instanceId, ...row })
      .select('id')
      .single()
    expect(error).toBeNull()
    return data!.id
  }

  async function read(table: 'workflow_template_steps' | 'workflow_steps', id: string) {
    // Template steps have no date or status; a live step's are part of
    // what "left exactly as it was" means.
    const columns =
      table === 'workflow_steps'
        ? 'config, timing, requires_approval, due_at, status'
        : 'config, timing, requires_approval'
    const { data, error } = await admin.from(table).select(columns).eq('id', id).single()
    expect(error).toBeNull()
    return data as unknown as StepRow
  }

  it('folds the offset on a template step and a pending, undated instance step; total delay unchanged', async () => {
    const offsetWait = {
      type: 'wait',
      config: { mode: 'duration', durationMinutes: DAY, respectQuietHours: true } as Json,
      timing: { mode: 'after_previous', delayAmount: 2, unit: 'days' } as Json,
      requires_approval: true,
    }
    const templateWait = await templateStep({ position: 1, ...offsetWait })
    const pendingWait = await instanceStep({
      position: 1,
      status: 'pending',
      type: 'wait',
      config: { mode: 'duration', durationMinutes: 60 } as Json,
      timing: { mode: 'after_previous', delayAmount: 3, unit: 'hours' } as Json,
      requires_approval: true,
    })
    const templateBefore = totalDelay(await read('workflow_template_steps', templateWait))
    const pendingBefore = totalDelay(await read('workflow_steps', pendingWait))

    applyMigration()

    const templateAfter = await read('workflow_template_steps', templateWait)
    expect(templateAfter.timing).toEqual(WAIT_TIMING)
    expect(templateAfter.requires_approval).toBe(false)
    expect(templateAfter.config).toEqual({ mode: 'duration', durationMinutes: 3 * DAY, respectQuietHours: true })
    expect(totalDelay(templateAfter)).toBe(templateBefore)

    const pendingAfter = await read('workflow_steps', pendingWait)
    expect(pendingAfter.timing).toEqual(WAIT_TIMING)
    expect(pendingAfter.requires_approval).toBe(false)
    expect(pendingAfter.config['durationMinutes']).toBe(240)
    expect(totalDelay(pendingAfter)).toBe(pendingBefore)

    // Safe to replay: a second run changes nothing.
    applyMigration()
    expect(await read('workflow_template_steps', templateWait)).toEqual(templateAfter)
    expect(await read('workflow_steps', pendingWait)).toEqual(pendingAfter)
  })

  it('turns a wedding-anchored template Wait into a wait relative to the event', async () => {
    const id = await templateStep({
      position: 2,
      type: 'wait',
      config: { mode: 'duration', durationMinutes: DAY } as Json,
      timing: { mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'weeks' } as Json,
    })

    applyMigration()

    const after = await read('workflow_template_steps', id)
    expect(after.timing).toEqual(WAIT_TIMING)
    expect(after.config).toEqual({
      mode: 'relative_to_event',
      relative: { amount: 13, unit: 'days', direction: 'before', anchor: 'event_date' },
    })
  })

  it('leaves dated, sleeping and non-Wait steps exactly as they were', async () => {
    const offset = { mode: 'after_previous', delayAmount: 1, unit: 'days' } as Json
    const dated = await instanceStep({
      position: 2,
      status: 'pending',
      type: 'wait',
      config: { mode: 'duration', durationMinutes: 60 } as Json,
      timing: offset,
      due_at: FUTURE,
      requires_approval: true,
    })
    const sleeping = await instanceStep({
      position: 3,
      status: 'waiting',
      type: 'wait',
      config: { mode: 'duration', durationMinutes: 60 } as Json,
      timing: offset,
      due_at: FUTURE,
    })
    const send = await templateStep({
      position: 3,
      type: 'action',
      config: { actionType: 'send_email' } as Json,
      timing: offset,
      requires_approval: true,
    })
    const before = await Promise.all([
      read('workflow_steps', dated),
      read('workflow_steps', sleeping),
      read('workflow_template_steps', send),
    ])

    applyMigration()

    const after = await Promise.all([
      read('workflow_steps', dated),
      read('workflow_steps', sleeping),
      read('workflow_template_steps', send),
    ])
    expect(after).toEqual(before)
  })

  it('the builder save folds an offset into a Wait and drops its review flag', async () => {
    activeUser = user
    const res = await upsertTemplateStepRow({
      templateId,
      position: 4,
      type: 'wait',
      config: { mode: 'duration', durationMinutes: 60 },
      timing: { mode: 'after_previous', delayAmount: 30, unit: 'minutes' },
      requiresApproval: true,
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const saved = await read('workflow_template_steps', res.data.id)
    expect(saved.config).toEqual({ mode: 'duration', durationMinutes: 90 })
    expect(saved.timing).toEqual(WAIT_TIMING)
    expect(saved.requires_approval).toBe(false)
  })
})

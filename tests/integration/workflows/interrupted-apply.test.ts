/**
 * An apply that fails or dies half way never strands the couple (Phase 3,
 * Task 19 fix round 1).
 *
 * `applyTemplate` builds a new instance while it is `paused` with no
 * `paused_reason`, and flips it live only at the end. If it fails in
 * between, or the function dies, that half-built row must not stay
 * paused: it would hold the couple's `dedupe_key`, so every later event
 * for the same workflow would be refused as "already applied", and a
 * Resume would put an unsettled, half-built workflow live.
 *
 * - A failure the apply sees is cancelled on the spot.
 * - A crash is cancelled by the tick's sweep once the row is stale.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { applyTemplate } from '@/lib/workflows/instantiate'
import { sweepInterruptedApplies } from '@/lib/workflows/interrupted-applies'
import type { Database, Json } from '@/types/database'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

const admin = serviceClient()
const MINUTE = 60_000
const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }

let user: TestUser

beforeAll(async () => {
  user = await createTestUser({}, PRO)
})

afterAll(async () => {
  await user?.cleanup()
})

async function newCouple(name: string): Promise<string> {
  const { data, error } = await admin
    .from('couples')
    .insert({ user_id: user.id, name, status: 'Enquiry' } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

async function template(name: string): Promise<string> {
  const { data, error } = await admin
    .from('workflow_templates')
    .insert({ user_id: user.id, name, status: 'active' } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const templateId = (data as { id: string }).id
  const { error: stepErr } = await admin.from('workflow_template_steps').insert({
    template_id: templateId,
    position: 0,
    type: 'todo',
    title: 'Call the venue',
    config: {},
    timing: { mode: 'apply_relative', amount: 3, unit: 'days' },
  } as never)
  if (stepErr) throw new Error(stepErr.message)
  return templateId
}

/**
 * The service client, except that inserting instance steps fails: the
 * step snapshot is the first write after the instance row exists.
 */
function failingStepInsert(): SupabaseClient<Database> {
  return new Proxy(admin, {
    get(target, prop, receiver) {
      if (prop !== 'from') return Reflect.get(target, prop, receiver)
      return (table: string) => {
        const builder = target.from(table as never)
        if (table !== 'workflow_steps') return builder
        return new Proxy(builder, {
          get(b, key, r) {
            if (key !== 'insert') return Reflect.get(b, key, r)
            return () => ({
              select: async () => ({ data: null, error: { message: 'forced step insert failure' } }),
            })
          },
        })
      }
    },
  }) as SupabaseClient<Database>
}

async function instancesOf(templateId: string, coupleId: string) {
  const { data } = await admin
    .from('workflow_instances')
    .select('id, status, paused_reason')
    .eq('template_id', templateId)
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: true })
  return data ?? []
}

async function auditEvents(instanceId: string): Promise<{ event: string; detail: Json }[]> {
  const { data } = await admin
    .from('workflow_audit_log')
    .select('event, detail')
    .eq('instance_id', instanceId)
  return (data ?? []) as { event: string; detail: Json }[]
}

describe('a failed apply', () => {
  it('is cancelled on the spot, and the same workflow applies again after', async () => {
    const t = await template('Fails once')
    const coupleId = await newCouple('Failed Apply')

    const failed = await applyTemplate(failingStepInsert(), {
      userId: user.id,
      templateId: t,
      coupleId,
      dedupe: true,
    })
    expect(failed).toMatchObject({ error: 'forced step insert failure' })

    const [orphan] = await instancesOf(t, coupleId)
    expect(orphan).toMatchObject({ status: 'cancelled' })
    expect(await auditEvents(orphan!.id)).toContainEqual({
      event: 'instance_cancelled',
      detail: { reason: 'setup_interrupted' },
    })

    const retry = await applyTemplate(admin, {
      userId: user.id,
      templateId: t,
      coupleId,
      dedupe: true,
    })
    expect(retry).toHaveProperty('instanceId')
    const rows = await instancesOf(t, coupleId)
    expect(rows.map((r) => r.status)).toEqual(['cancelled', 'active'])
  })
})

describe('the sweep for an apply that died half way', () => {
  /** An instance row in a given paused state, applied `minutesAgo`. */
  async function pausedRow(
    name: string,
    reason: 'manual' | 'template_off' | null,
    minutesAgo: number,
  ): Promise<string> {
    const coupleId = await newCouple(name)
    const { data, error } = await admin
      .from('workflow_instances')
      .insert({
        user_id: user.id,
        couple_id: coupleId,
        name,
        status: 'paused',
        paused_reason: reason,
        applied_at: new Date(Date.now() - minutesAgo * MINUTE).toISOString(),
      } as never)
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return (data as { id: string }).id
  }

  async function row(id: string) {
    const { data } = await admin
      .from('workflow_instances')
      .select('status, paused_reason')
      .eq('id', id)
      .single()
    return data!
  }

  it('cancels a stale half-built instance and nothing the MC or the switch paused', async () => {
    const stale = await pausedRow('Stale Setup', null, 11)
    const fresh = await pausedRow('Fresh Setup', null, 2)
    const manual = await pausedRow('Manual Pause', 'manual', 60)
    const switchedOff = await pausedRow('Switched Off', 'template_off', 60)

    const cancelled = await sweepInterruptedApplies(admin)

    expect(cancelled).toBeGreaterThanOrEqual(1)
    expect(await row(stale)).toEqual({ status: 'cancelled', paused_reason: null })
    expect(await auditEvents(stale)).toContainEqual({
      event: 'instance_cancelled',
      detail: { reason: 'setup_interrupted' },
    })
    // Still being built: an apply takes seconds, not ten minutes.
    expect(await row(fresh)).toEqual({ status: 'paused', paused_reason: null })
    expect(await row(manual)).toEqual({ status: 'paused', paused_reason: 'manual' })
    expect(await row(switchedOff)).toEqual({ status: 'paused', paused_reason: 'template_off' })
  })
})

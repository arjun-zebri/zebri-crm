/**
 * An apply that something else stopped while it was being built (Phase 3
 * fix wave, M1 to M3).
 *
 * `applyTemplate` builds a new instance while it is `paused` with no
 * reason, and flips it live at the end. Three things can land while it
 * builds, and each has to end with nothing live and the caller told so:
 *
 * - M1: the instance is stopped just before the flip. The flip finds it
 *   no longer building and does nothing; the apply must not report
 *   "started", and the dispatcher must not count an opened enrolment.
 * - M2: the instance is stopped before its steps are inserted. The steps
 *   inserted after the stop must not sit `pending` on a stopped instance.
 * - M3: a draft applied by hand is archived mid-apply. An archived
 *   workflow takes no couples, so the instance must not go live.
 *
 * Each concurrent write is made at an exact point in the real apply by
 * `faultyClient`'s `before` hook, against the local database.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { dispatchPendingEvents } from '@/lib/workflows/dispatcher'
import { applyTemplate } from '@/lib/workflows/instantiate'
import type { Json } from '@/types/database'

import { faultyClient } from '../helpers/faulty-client'
import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

const admin = serviceClient()
const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }

let user: TestUser
const users: TestUser[] = []

beforeEach(async () => {
  user = await createTestUser({}, PRO)
  users.push(user)
})

afterAll(async () => {
  for (const u of users) await u.cleanup()
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

/** A template of two stage moves, a year out, so nothing is due. */
async function template(status: 'active' | 'draft', applyRuleType?: string): Promise<string> {
  const { data, error } = await admin
    .from('workflow_templates')
    .insert({
      user_id: user.id,
      name: `Go live ${status}`,
      status,
      ...(applyRuleType ? { apply_rule_type: applyRuleType, apply_rule_config: {} } : {}),
    } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const templateId = (data as { id: string }).id
  const timing: Json = { mode: 'apply_relative', amount: 365, unit: 'days' }
  const { error: stepsErr } = await admin.from('workflow_template_steps').insert(
    [0, 1].map((position) => ({
      template_id: templateId,
      position,
      type: 'action',
      title: `Step ${position}`,
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
      timing,
      parent_step_id: null,
      branch_path: null,
    })) as never,
  )
  if (stepsErr) throw new Error(stepsErr.message)
  return templateId
}

/** The couple's one non-default instance. */
async function builtInstance(coupleId: string) {
  const { data } = await admin
    .from('workflow_instances')
    .select('id, status, paused_reason, cancelled_reason')
    .eq('couple_id', coupleId)
    .eq('is_default', false)
    .single()
  return data!
}

async function stepStatuses(instanceId: string): Promise<string[]> {
  const { data } = await admin.from('workflow_steps').select('status').eq('instance_id', instanceId)
  return (data ?? []).map((r) => r.status)
}

/** Stop whichever instance this couple is being built, as an exit rule would. */
function stopBuilding(coupleId: string): () => Promise<void> {
  return async () => {
    const { error } = await admin
      .from('workflow_instances')
      .update({
        status: 'cancelled',
        cancelled_reason: 'exit_rule',
        completed_at: new Date().toISOString(),
      } as never)
      .eq('couple_id', coupleId)
      .eq('is_default', false)
      .eq('status', 'paused')
    if (error) throw new Error(error.message)
  }
}

describe('an instance stopped just before it goes live (M1)', () => {
  it('reports the apply as skipped, not started', async () => {
    const coupleId = await newCouple('Stopped Before Flip')
    // The settle's read of the steps is the last query before the flip:
    // the apply's own read-back of its inserts is the first steps read.
    const faulty = faultyClient(admin, [
      { table: 'workflow_steps', verb: 'select', skip: 1, before: stopBuilding(coupleId) },
    ])

    const result = await applyTemplate(faulty.client, {
      userId: user.id,
      templateId: await template('active'),
      coupleId,
    })

    expect(faulty.failed()).toBe(1)
    expect(result).toEqual({ error: expect.any(String), skipped: 'stopped' })
    expect(await builtInstance(coupleId)).toMatchObject({
      status: 'cancelled',
      cancelled_reason: 'exit_rule',
    })
  })
})

describe('the dispatcher and an enrolment stopped just before it goes live (M1)', () => {
  it('does not count it as opened', async () => {
    await template('active', 'on_couple_created')
    // Drain anything already on the bus for this MC.
    await dispatchPendingEvents(admin, 5000, { userId: user.id })
    const coupleId = await newCouple('Dispatched Stopped')
    const faulty = faultyClient(admin, [
      // The apply's read-back of its inserts is the first `*` read of the
      // steps; the settle's is the second.
      { table: 'workflow_steps', verb: 'select', when: (a) => a === '*', skip: 1, before: stopBuilding(coupleId) },
    ])

    const result = await dispatchPendingEvents(faulty.client, 5000, { userId: user.id })

    expect(faulty.failed()).toBe(1)
    expect(result.matchedTemplates).toBe(1)
    expect(result.openedInstances).toBe(0)
    expect((await builtInstance(coupleId)).status).toBe('cancelled')
  })
})

describe('an instance stopped before its steps are inserted (M2)', () => {
  it('leaves none of them pending on the stopped instance', async () => {
    const coupleId = await newCouple('Stopped Before Steps')
    const faulty = faultyClient(admin, [
      { table: 'workflow_template_steps', verb: 'select', before: stopBuilding(coupleId) },
    ])

    const result = await applyTemplate(faulty.client, {
      userId: user.id,
      templateId: await template('active'),
      coupleId,
    })

    expect(faulty.failed()).toBe(1)
    expect(result).toEqual({ error: expect.any(String), skipped: 'stopped' })
    const inst = await builtInstance(coupleId)
    expect(inst).toMatchObject({ status: 'cancelled', cancelled_reason: 'exit_rule' })
    const statuses = await stepStatuses(inst.id)
    expect(statuses).toHaveLength(2)
    expect(statuses.every((s) => s === 'cancelled')).toBe(true)
  })
})

describe('a draft applied by hand and archived mid-apply (M3)', () => {
  it('does not go live', async () => {
    const coupleId = await newCouple('Archived Mid Apply')
    const templateId = await template('draft')
    const faulty = faultyClient(admin, [
      {
        table: 'workflow_steps',
        verb: 'select',
        skip: 1,
        before: async () => {
          const { error } = await admin.rpc('set_workflow_template_status', {
            p_template_id: templateId,
            p_status: 'archived',
          })
          if (error) throw new Error(error.message)
        },
      },
    ])

    const result = await applyTemplate(faulty.client, { userId: user.id, templateId, coupleId })

    expect(faulty.failed()).toBe(1)
    expect(result).toMatchObject({ pausedReason: 'template_off' })
    expect(await builtInstance(coupleId)).toMatchObject({
      status: 'paused',
      paused_reason: 'template_off',
    })
  })

  it('a draft applied by hand and left alone still goes live', async () => {
    const coupleId = await newCouple('Draft Left Alone')
    const result = await applyTemplate(admin, {
      userId: user.id,
      templateId: await template('draft'),
      coupleId,
    })
    expect(result).toEqual({ instanceId: expect.any(String) })
    expect((await builtInstance(coupleId)).status).toBe('active')
  })
})

/**
 * The wedding-date recompute is not callable from outside (Phase 3 fix
 * wave, I5).
 *
 * `_workflow_recompute_wedding_steps` is SECURITY DEFINER and takes any
 * couple id. Executable by `anon` and `authenticated`, it let anyone
 * holding another tenant's couple id re-date that tenant's steps: it
 * undoes an MC's manual reschedule, putting a send they snoozed back on
 * its past wedding-relative date, to go on the next tick. Only the two
 * SECURITY DEFINER triggers on `couples` and `events` should reach it,
 * and they still must.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Json } from '@/types/database'

import { anonClient, createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

const admin = serviceClient()
const DAY = 86_400_000
const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }

let owner: TestUser
let attacker: TestUser

beforeAll(async () => {
  owner = await createTestUser({}, PRO)
  attacker = await createTestUser({}, PRO)
})

afterAll(async () => {
  await owner?.cleanup()
  await attacker?.cleanup()
})

const dateIn = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10)
const WEEK_BEFORE: Json = { mode: 'wedding_relative', direction: 'before', amount: 1, unit: 'weeks' }

/** An owner's couple with a pending wedding-relative step, snoozed by hand. */
async function snoozedStep(eventDate: string) {
  const { data: couple, error } = await admin
    .from('couples')
    .insert({ user_id: owner.id, name: 'Grant Couple', status: 'Enquiry', event_date: eventDate } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const coupleId = (couple as { id: string }).id
  const { data: inst, error: instErr } = await admin
    .from('workflow_instances')
    .insert({
      user_id: owner.id,
      couple_id: coupleId,
      name: 'Grant flow',
      applied_at: new Date().toISOString(),
    } as never)
    .select('id')
    .single()
  if (instErr) throw new Error(instErr.message)
  const snoozedTo = new Date(Date.now() + 30 * DAY).toISOString()
  const { data: step, error: stepErr } = await admin
    .from('workflow_steps')
    .insert({
      instance_id: (inst as { id: string }).id,
      position: 0,
      type: 'action',
      title: 'Snoozed send',
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
      timing: WEEK_BEFORE,
      status: 'pending',
      due_at: snoozedTo,
    } as never)
    .select('id')
    .single()
  if (stepErr) throw new Error(stepErr.message)
  return { coupleId, stepId: (step as { id: string }).id, snoozedTo }
}

async function dueAt(stepId: string): Promise<string | null> {
  const { data } = await admin.from('workflow_steps').select('due_at').eq('id', stepId).single()
  return data!.due_at
}

describe('calling the recompute helpers directly', () => {
  it('is refused for a signed-in user, and another tenant\'s snooze stands', async () => {
    const { coupleId, stepId, snoozedTo } = await snoozedStep(dateIn(21))

    const { error } = await attacker.client.rpc('_workflow_recompute_wedding_steps', {
      p_couple_id: coupleId,
    })

    expect(error?.code).toBe('42501')
    expect(error?.message).toMatch(/permission denied/)
    expect(new Date((await dueAt(stepId))!).getTime()).toBe(new Date(snoozedTo).getTime())
  })

  it('is refused for an anonymous caller', async () => {
    const { coupleId } = await snoozedStep(dateIn(21))
    const { error } = await anonClient().rpc('_workflow_recompute_wedding_steps', {
      p_couple_id: coupleId,
    })
    expect(error?.code).toBe('42501')
  })

  it('refuses the wake helper too', async () => {
    // Not in the generated types (never meant to be an API), hence the cast.
    const { error } = await attacker.client.rpc('_workflow_wait_relative_wake' as never, {
      p_config: { mode: 'relative_to_event' },
      p_date: dateIn(21),
    } as never)
    expect(error?.code).toBe('42501')
  })
})

describe('the triggers that own the recompute', () => {
  it('still re-date a wedding-relative step when the couple\'s wedding date moves', async () => {
    const { coupleId, stepId } = await snoozedStep(dateIn(21))

    const { error } = await owner.client
      .from('couples')
      .update({ event_date: dateIn(60) } as never)
      .eq('id', coupleId)
    expect(error).toBeNull()

    const moved = new Date((await dueAt(stepId))!)
    // A week before the new date, give or take the zone's midnight.
    const expected = Date.now() + 53 * DAY
    expect(Math.abs(moved.getTime() - expected)).toBeLessThan(DAY + 3_600_000)
  })

  it('still re-date it when a wedding event is added', async () => {
    const { coupleId, stepId } = await snoozedStep(dateIn(21))

    const { error } = await owner.client
      .from('events')
      .insert({ couple_id: coupleId, user_id: owner.id, date: dateIn(10) } as never)
    expect(error).toBeNull()

    const moved = new Date((await dueAt(stepId))!)
    const expected = Date.now() + 3 * DAY
    expect(Math.abs(moved.getTime() - expected)).toBeLessThan(DAY + 3_600_000)
  })
})

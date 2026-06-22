/**
 * Couple Automations tab — per-run / per-automation control actions.
 *
 * Proves the four controls round-trip under real RLS and that
 * cross-tenant attempts are silent no-ops:
 *   - retryRunAction              errored → running (error cleared)
 *   - cancelRunAction             waiting → cancelled
 *   - pauseAutomationForCouple    running/waiting → paused (scoped)
 *   - resumeAutomationForCouple   paused → running (no pending wait)
 *
 * The subtle resume-state split (waiting vs running) is unit-tested
 * in `tests/unit/lib/automations/run-controls.test.ts`; here we cover
 * the IO + the RLS boundary.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

let activeUser: TestUser | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user — set `activeUser` first')
    return activeUser.client
  }),
}))

// eslint-disable-next-line import/order
import {
  cancelRunAction,
  pauseAutomationForCoupleAction,
  resumeAutomationForCoupleAction,
  retryRunAction,
} from '@/app/(dashboard)/automations/actions'

/** A seeded couple owned by `user`. */
async function seedCouple(user: TestUser): Promise<string> {
  const { data, error } = await serviceClient()
    .from('couples')
    .insert({ user_id: user.id, name: 'Test couple', status: 'enquiry', kanban_position: 0 } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

/** A seeded automation owned by `user`. */
async function seedAutomation(user: TestUser): Promise<string> {
  const { data, error } = await serviceClient()
    .from('automations')
    .insert({ user_id: user.id, name: 'Test flow', trigger_type: 'invoice_overdue', status: 'active' } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

/** Seed one run (with its own event) for `user` under `automationId`. */
async function seedRun(
  user: TestUser,
  automationId: string,
  status: string,
  coupleId: string | null,
): Promise<string> {
  const svc = serviceClient()
  const { data: ev, error: evErr } = await svc
    .from('automation_events')
    .insert({ user_id: user.id, source_table: 'manual', event_type: 'invoice_overdue', couple_id: coupleId } as never)
    .select('id')
    .single()
  if (evErr) throw new Error(evErr.message)
  const { data: run, error: runErr } = await svc
    .from('automation_runs')
    .insert({
      automation_id: automationId,
      event_id: (ev as { id: string }).id,
      user_id: user.id,
      couple_id: coupleId,
      status,
    } as never)
    .select('id')
    .single()
  if (runErr) throw new Error(runErr.message)
  return (run as { id: string }).id
}

async function statusOf(runId: string): Promise<string> {
  const { data } = await serviceClient().from('automation_runs').select('status').eq('id', runId).single()
  return (data as { status: string }).status
}

afterEach(() => {
  activeUser = null
})

describe('retryRunAction — integration', () => {
  it('re-opens an errored run and clears the error', async () => {
    const user = await createTestUser()
    const automationId = await seedAutomation(user)
    const runId = await seedRun(user, automationId, 'errored', null)
    await serviceClient()
      .from('automation_runs')
      .update({ error_message: 'boom', completed_at: new Date().toISOString() } as never)
      .eq('id', runId)

    activeUser = user
    const res = await retryRunAction({ runId })
    expect(res.ok).toBe(true)
    expect(await statusOf(runId)).toBe('running')

    const { data } = await serviceClient()
      .from('automation_runs')
      .select('error_message')
      .eq('id', runId)
      .single()
    expect((data as { error_message: string | null }).error_message).toBeNull()
    await user.cleanup()
  })

  it('is a no-op across tenants', async () => {
    const owner = await createTestUser()
    const attacker = await createTestUser()
    const automationId = await seedAutomation(owner)
    const runId = await seedRun(owner, automationId, 'errored', null)

    activeUser = attacker
    await retryRunAction({ runId })
    expect(await statusOf(runId)).toBe('errored')
    await owner.cleanup()
    await attacker.cleanup()
  })
})

describe('cancelRunAction — integration', () => {
  it('cancels a waiting run', async () => {
    const user = await createTestUser()
    const automationId = await seedAutomation(user)
    const runId = await seedRun(user, automationId, 'waiting', null)
    activeUser = user
    expect((await cancelRunAction({ runId })).ok).toBe(true)
    expect(await statusOf(runId)).toBe('cancelled')
    await user.cleanup()
  })

  it('leaves a completed run alone', async () => {
    const user = await createTestUser()
    const automationId = await seedAutomation(user)
    const runId = await seedRun(user, automationId, 'completed', null)
    activeUser = user
    await cancelRunAction({ runId })
    expect(await statusOf(runId)).toBe('completed')
    await user.cleanup()
  })
})

describe('pause / resume automation for couple — integration', () => {
  it('pauses live runs then resumes them to running (no pending wait)', async () => {
    const user = await createTestUser()
    const coupleId = await seedCouple(user)
    const automationId = await seedAutomation(user)
    const r1 = await seedRun(user, automationId, 'running', coupleId)
    const r2 = await seedRun(user, automationId, 'waiting', coupleId)

    activeUser = user
    const paused = await pauseAutomationForCoupleAction({ automationId, coupleId })
    expect(paused.ok && paused.data.paused).toBe(2)
    expect(await statusOf(r1)).toBe('paused')
    expect(await statusOf(r2)).toBe('paused')

    const resumed = await resumeAutomationForCoupleAction({ automationId, coupleId })
    expect(resumed.ok && resumed.data.resumed).toBe(2)
    // No automation_waits seeded → both resume to running.
    expect(await statusOf(r1)).toBe('running')
    expect(await statusOf(r2)).toBe('running')
    await user.cleanup()
  })

  it('is a no-op across tenants', async () => {
    const owner = await createTestUser()
    const attacker = await createTestUser()
    const coupleId = await seedCouple(owner)
    const automationId = await seedAutomation(owner)
    const runId = await seedRun(owner, automationId, 'running', coupleId)

    activeUser = attacker
    await pauseAutomationForCoupleAction({ automationId, coupleId })
    expect(await statusOf(runId)).toBe('running')
    await owner.cleanup()
    await attacker.cleanup()
  })
})

/**
 * "Run an automation now" — runAutomationForCoupleAction.
 *
 * Proves the manual-run path end to end under real RLS: ownership is
 * enforced, a run is opened and executed inline (the add_note action's
 * side effect lands), and a cross-tenant attempt is a clean failure
 * that touches nothing.
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
  runAutomationForCoupleAction,
  testAutomationForCoupleAction,
} from '@/app/(dashboard)/automations/actions'

const NOTE = 'Note from a manual run'

/** Seed a couple + an active one-step (add_note) automation. */
async function seed(user: TestUser): Promise<{ coupleId: string; automationId: string }> {
  const svc = serviceClient()
  const { data: couple, error: cErr } = await svc
    .from('couples')
    .insert({ user_id: user.id, name: 'Run-now couple', status: 'enquiry', kanban_position: 0 } as never)
    .select('id')
    .single()
  if (cErr) throw new Error(cErr.message)
  const coupleId = (couple as { id: string }).id

  const { data: auto, error: aErr } = await svc
    .from('automations')
    .insert({ user_id: user.id, name: 'Add a note', trigger_type: 'manual_fire', status: 'active' } as never)
    .select('id')
    .single()
  if (aErr) throw new Error(aErr.message)
  const automationId = (auto as { id: string }).id

  const { error: actErr } = await svc.from('automation_actions').insert({
    automation_id: automationId,
    type: 'add_note',
    position: 0,
    parent_action_id: null,
    config: { text: NOTE },
  } as never)
  if (actErr) throw new Error(actErr.message)

  return { coupleId, automationId }
}

async function coupleNotes(coupleId: string): Promise<string> {
  const { data } = await serviceClient().from('couples').select('notes').eq('id', coupleId).single()
  return (data as { notes: string | null }).notes ?? ''
}

async function runCount(coupleId: string): Promise<number> {
  const { count } = await serviceClient()
    .from('automation_runs')
    .select('id', { count: 'exact', head: true })
    .eq('couple_id', coupleId)
  return count ?? 0
}

afterEach(() => {
  activeUser = null
})

describe('runAutomationForCoupleAction — integration', () => {
  it('opens and executes a run, landing the action side effect', async () => {
    const user = await createTestUser()
    const { coupleId, automationId } = await seed(user)

    activeUser = user
    const res = await runAutomationForCoupleAction({ automationId, coupleId })
    expect(res.ok).toBe(true)

    expect(await coupleNotes(coupleId)).toContain(NOTE)
    expect(await runCount(coupleId)).toBe(1)

    const { data: run } = await serviceClient()
      .from('automation_runs')
      .select('status')
      .eq('couple_id', coupleId)
      .single()
    expect((run as { status: string }).status).toBe('completed')
    await user.cleanup()
  })

  it('test run executes non-email actions and stamps test_mode on the event', async () => {
    const user = await createTestUser()
    const { coupleId, automationId } = await seed(user)

    activeUser = user
    const res = await testAutomationForCoupleAction({ automationId, coupleId })
    expect(res.ok).toBe(true)
    // add_note still runs for real…
    expect(await coupleNotes(coupleId)).toContain(NOTE)
    // …and the synthetic event is flagged so send_email would redirect.
    const { data: ev } = await serviceClient()
      .from('automation_events')
      .select('payload')
      .eq('couple_id', coupleId)
      .eq('event_type', 'manual_fire')
      .single()
    expect((ev as { payload: Record<string, unknown> }).payload.test_mode).toBe(true)
    await user.cleanup()
  })

  it('rejects an inactive automation', async () => {
    const user = await createTestUser()
    const { coupleId, automationId } = await seed(user)
    await serviceClient().from('automations').update({ status: 'draft' } as never).eq('id', automationId)

    activeUser = user
    const res = await runAutomationForCoupleAction({ automationId, coupleId })
    expect(res.ok).toBe(false)
    expect(await runCount(coupleId)).toBe(0)
    await user.cleanup()
  })

  it('is a no-op across tenants — cannot run another MC’s automation', async () => {
    const owner = await createTestUser()
    const attacker = await createTestUser()
    const { coupleId, automationId } = await seed(owner)

    activeUser = attacker
    const res = await runAutomationForCoupleAction({ automationId, coupleId })
    expect(res.ok).toBe(false)
    expect(await coupleNotes(coupleId)).toBe('')
    expect(await runCount(coupleId)).toBe(0)
    await owner.cleanup()
    await attacker.cleanup()
  })
})

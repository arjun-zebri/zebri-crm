/**
 * A workflow turned off mid-dispatch takes no new couples (Phase 3,
 * Task 17 fix round 1).
 *
 * The dispatcher loads its candidate templates once per event, while
 * they are active, and applies each match afterwards. A template turned
 * off in between used to be applied anyway, because `applyTemplate`
 * refused only archived templates: a couple was enrolled, `active`, on a
 * workflow the MC had just switched off, after the switch's sweep had
 * already run. A BEFORE INSERT trigger now refuses an event-driven
 * enrolment on a template that is not active, and the dispatcher counts
 * that as a quiet skip.
 *
 * The flip is driven deterministically: `applyTemplate` is wrapped so the
 * template is switched off after the candidate load and before the insert.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { dispatchPendingEvents } from '@/lib/workflows/dispatcher'
import { applyTemplate } from '@/lib/workflows/instantiate'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

/** Template ids to switch off just before their apply. */
const flipBeforeApply = new Set<string>()

vi.mock('@/lib/workflows/instantiate', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/workflows/instantiate')>()
  return {
    ...actual,
    applyTemplate: async (...args: Parameters<typeof actual.applyTemplate>) => {
      const [client, opts] = args
      if (flipBeforeApply.has(opts.templateId)) {
        const { error } = await client
          .from('workflow_templates')
          .update({ status: 'draft' })
          .eq('id', opts.templateId)
        if (error) throw new Error(error.message)
      }
      return actual.applyTemplate(...args)
    },
  }
})

const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const admin = serviceClient()
let user: TestUser

beforeAll(async () => {
  user = await createTestUser({}, PRO)
})

beforeEach(async () => {
  // Start from a drained bus for this user.
  await dispatchPendingEvents(admin, 5000, { userId: user.id })
})

afterEach(async () => {
  flipBeforeApply.clear()
  await admin.from('workflow_templates').update({ status: 'archived' }).eq('user_id', user.id)
})

async function template(status: string): Promise<string> {
  const { data, error } = await admin
    .from('workflow_templates')
    .insert({
      user_id: user.id,
      name: `Race ${status}`,
      status,
      apply_rule_type: 'on_couple_created',
      apply_rule_config: {},
    } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

async function newCouple(name: string): Promise<string> {
  const { data, error } = await admin
    .from('couples')
    .insert({ user_id: user.id, name } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

async function instancesOf(templateId: string) {
  const { data } = await admin
    .from('workflow_instances')
    .select('id, status')
    .eq('template_id', templateId)
  return data ?? []
}

describe('a workflow turned off between candidate load and apply', () => {
  it('enrols no one, and the dispatch reports a quiet skip', async () => {
    const t = await template('active')
    flipBeforeApply.add(t)
    await newCouple('Race Couple')
    const errors = vi.spyOn(console, 'error')

    const result = await dispatchPendingEvents(admin, 5000, { userId: user.id })

    expect(result.matchedTemplates).toBe(1)
    expect(result.openedInstances).toBe(0)
    expect(result.skippedOffTemplates).toBe(1)
    expect(await instancesOf(t)).toEqual([])
    // A skip, not a failure.
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })
})

describe('the enrolment guard', () => {
  it('refuses an event-driven enrolment on a template that is not active', async () => {
    const t = await template('draft')
    const coupleId = await newCouple('Guard Couple')
    const { data: event } = await admin
      .from('automation_events')
      .select('id')
      .eq('couple_id', coupleId)
      .limit(1)
      .single()

    const { error } = await admin.from('workflow_instances').insert({
      user_id: user.id,
      couple_id: coupleId,
      template_id: t,
      name: 'Guarded',
      trigger_event_id: event!.id,
    } as never)
    expect(error?.code).toBe('WF001')
  })

  it('still lets the MC apply a draft by hand', async () => {
    const t = await template('draft')
    const coupleId = await newCouple('Manual Draft Couple')

    const result = await applyTemplate(admin, {
      userId: user.id,
      templateId: t,
      coupleId,
      dedupe: false,
    })
    expect('instanceId' in result).toBe(true)
  })
})

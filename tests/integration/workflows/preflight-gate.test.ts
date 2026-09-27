/**
 * Turn on is refused while a workflow is unfinished (Task 34, audit M7).
 *
 * Every switch that turns a workflow on (the canvas button and the
 * library card) goes through `setTemplateStatusAction`, so the gate lives
 * there, on the server, and each case below runs that real action under
 * real RLS: no steps, a send with no subject, a branch with no condition,
 * an appointment still called "Give it a name", the picker's Stop step.
 * Each is refused and the workflow stays off; a finished one turns on.
 * `templatePreflightAction` is what the switches read to show the list.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  setTemplateStatusAction,
  templatePreflightAction,
} from '@/app/(dashboard)/workflows/actions'
import { applyTemplateToCoupleAction } from '@/app/(dashboard)/workflows/instance-actions'
import { sendAlert } from '@/lib/alerts/send-alert'
import { applyTemplate } from '@/lib/workflows/instantiate'
import type { Database } from '@/types/database'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

vi.mock('@/lib/alerts/send-alert', () => ({ sendAlert: vi.fn(async () => true) }))

// `revalidatePath` needs a Next request store, which vitest cannot give it.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

let activeUser: TestUser | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user, set `activeUser` first')
    return activeUser.client
  }),
}))

const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const RECIPIENTS = { roles: ['primary'], fallback: 'primary_only' }
const FINISHED_SEND = { actionType: 'send_email', recipients: RECIPIENTS, subject: 'Welcome', body: 'Hi' }

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

interface StepSeed {
  type: string
  title?: string
  config: Record<string, unknown>
  disabled?: boolean
}

/** A draft template of the owner's holding `steps`, in order. */
async function draft(name: string, steps: StepSeed[], status = 'draft'): Promise<string> {
  const { data, error } = await admin
    .from('workflow_templates')
    .insert({ user_id: owner.id, name, status } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const id = (data as { id: string }).id
  if (steps.length > 0) {
    const { error: stepErr } = await admin.from('workflow_template_steps').insert(
      steps.map((s, i) => ({
        template_id: id,
        position: (i + 1) * 100,
        type: s.type,
        title: s.title ?? '',
        config: s.config,
        disabled: s.disabled ?? false,
      })) as never,
    )
    if (stepErr) throw new Error(stepErr.message)
  }
  return id
}

async function status(id: string): Promise<string> {
  const { data } = await admin.from('workflow_templates').select('status').eq('id', id).single()
  return (data as { status: string }).status
}

/** Turn it on as the owner; expect a refusal that mentions `words`. */
async function expectRefused(id: string, words: string): Promise<void> {
  activeUser = owner
  const res = await setTemplateStatusAction({ templateId: id, status: 'active' })
  expect(res.ok).toBe(false)
  if (!res.ok) expect(res.error).toContain(words)
  expect(await status(id)).toBe('draft')
}

describe('Turn on refuses an unfinished workflow', () => {
  it('with no steps', async () => {
    await expectRefused(await draft('Empty', []), 'It has no steps yet')
  })

  it('with a send that has no subject', async () => {
    const id = await draft('No subject', [
      { type: 'action', config: { ...FINISHED_SEND, subject: '' } },
    ])
    await expectRefused(id, 'Send email: Subject is required.')
  })

  it('with a picker placeholder that was never filled in', async () => {
    const id = await draft('Placeholder', [{ type: 'action', config: { actionType: 'create_task' } }])
    await expectRefused(id, 'Title is required.')
  })

  it('with a branch that has no condition', async () => {
    const id = await draft('No condition', [
      { type: 'action', config: FINISHED_SEND },
      { type: 'branch', config: {} },
    ])
    await expectRefused(id, 'Branch: No condition chosen.')
  })

  it('with an appointment still called "Give it a name"', async () => {
    const id = await draft('Unnamed appointment', [
      { type: 'appointment', title: 'Give it a name', config: {} },
    ])
    await expectRefused(id, "No name yet, so it won't say what to do on the day.")
  })

  // Phase 6 fix wave: Stop was removed from the picker, so a saved one is
  // named as removed, not "can't run yet" (product change).
  it('with the Stop step, which the engine cannot run', async () => {
    const id = await draft('Stop step', [
      { type: 'action', config: FINISHED_SEND },
      { type: 'action', config: { actionType: 'stop' } },
    ])
    await expectRefused(id, "Stop: Stop isn't a step Zebri runs. Remove it; a workflow ends once its last step is done.")
  })
})

describe('Turn on accepts a finished workflow', () => {
  it('turns it on', async () => {
    const id = await draft('Finished', [
      { type: 'action', config: FINISHED_SEND },
      { type: 'appointment', title: 'Venue walkthrough', config: {} },
      {
        type: 'branch',
        config: { predicate: { kind: 'has_signed_contract' } },
      },
    ])
    activeUser = owner
    expect(await setTemplateStatusAction({ templateId: id, status: 'active' })).toEqual({
      ok: true,
      data: { paused: 0, resumed: 0, stillPaused: 0 },
    })
    expect(await status(id)).toBe('active')
  })

  it('ignores a disabled step, which never reaches a couple', async () => {
    const id = await draft('Disabled broken step', [
      { type: 'action', config: FINISHED_SEND },
      { type: 'branch', config: {}, disabled: true },
    ])
    activeUser = owner
    expect((await setTemplateStatusAction({ templateId: id, status: 'active' })).ok).toBe(true)
  })

  it('never blocks turning an unfinished workflow off', async () => {
    const id = await draft('Broken but on', [{ type: 'branch', config: {} }], 'active')
    activeUser = owner
    expect((await setTemplateStatusAction({ templateId: id, status: 'draft' })).ok).toBe(true)
    expect(await status(id)).toBe('draft')
  })
})

describe('templatePreflightAction', () => {
  it('lists every unfinished step, with the step to badge', async () => {
    const id = await draft('Listed', [
      { type: 'action', config: FINISHED_SEND },
      { type: 'branch', config: {} },
      { type: 'todo', title: '', config: {} },
    ])
    const { data: rows } = await admin
      .from('workflow_template_steps')
      .select('id, type')
      .eq('template_id', id)
      .order('position')
    const byType = new Map((rows as { id: string; type: string }[]).map((r) => [r.type, r.id]))

    activeUser = owner
    const res = await templatePreflightAction({ templateId: id })
    expect(res).toEqual({
      ok: true,
      data: {
        problems: [
          { stepId: byType.get('branch'), kind: 'config', title: 'Branch', message: 'No condition chosen.' },
          {
            stepId: byType.get('todo'),
            kind: 'unnamed',
            title: 'To-do',
            message: "No name yet, so it won't say what to do on the day.",
          },
        ],
      },
    })
  })

  it('tells another tenant nothing, and will not turn it on for them', async () => {
    const id = await draft('Not yours', [{ type: 'action', config: FINISHED_SEND }])
    activeUser = attacker
    expect(await templatePreflightAction({ templateId: id })).toEqual({
      ok: false,
      error: 'Workflow not found.',
    })
    activeUser = attacker
    expect((await setTemplateStatusAction({ templateId: id, status: 'active' })).ok).toBe(false)
    expect(await status(id)).toBe('draft')
  })
})

describe('applying an unfinished workflow to a couple by hand', () => {
  async function couple(name: string): Promise<string> {
    const { data, error } = await admin
      .from('couples')
      .insert({ user_id: owner.id, name, status: 'Enquiry' } as never)
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return (data as { id: string }).id
  }

  /** Enrolments of `templateId` on the couple (not its default to-do list). */
  async function enrolments(coupleId: string, templateId: string): Promise<number> {
    const { count } = await admin
      .from('workflow_instances')
      .select('id', { count: 'exact', head: true })
      .eq('couple_id', coupleId)
      .eq('template_id', templateId)
    return count ?? 0
  }

  it('is refused with the list, and enrols nobody', async () => {
    const id = await draft('Hand apply unfinished', [
      { type: 'action', config: FINISHED_SEND },
      { type: 'branch', config: {} },
    ])
    const coupleId = await couple('Hand Apply Refused')
    activeUser = owner
    const res = await applyTemplateToCoupleAction({ templateId: id, coupleId, force: false })
    expect(res).toEqual({
      ok: false,
      error: 'Finish 1 step before starting this on a couple. Branch: No condition chosen.',
    })
    expect(await enrolments(coupleId, id)).toBe(0)
  })

  it('refuses a snapshot of steps that changed after the pre-flight passed them, without an alert', async () => {
    const id = await draft('Hand apply raced', [{ type: 'todo', title: 'Ring the venue', config: {} }])
    const revision = (
      (await admin.from('workflow_templates').select('steps_revision').eq('id', id).single()).data as {
        steps_revision: number
      }
    ).steps_revision

    // Edited before the apply began: refused before anything is written.
    const early = await applyTemplate(admin, {
      userId: owner.id,
      templateId: id,
      coupleId: await couple('Hand Apply Early'),
      expectedStepsRevision: revision - 1,
    })
    expect(early).toEqual({ error: 'This workflow changed while it was being started. Try again.', skipped: 'changed' })

    // Edited while the apply read its snapshot: the half-built instance
    // is stopped and nobody is enrolled.
    const lateCouple = await couple('Hand Apply Late')
    const late = await applyTemplate(
      editWhileSnapshotting(id, async () => {
        const { error } = await admin
          .from('workflow_template_steps')
          .update({ title: '' })
          .eq('template_id', id)
        expect(error).toBeNull()
      }),
      { userId: owner.id, templateId: id, coupleId: lateCouple, expectedStepsRevision: revision },
    )
    expect(late).toEqual({ error: 'This workflow changed while it was being started. Try again.', skipped: 'changed' })
    const { count } = await admin
      .from('workflow_instances')
      .select('id', { count: 'exact', head: true })
      .eq('couple_id', lateCouple)
      .eq('template_id', id)
      .neq('status', 'cancelled')
    expect(count).toBe(0)
    expect(vi.mocked(sendAlert)).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'workflow_apply_failed' }))
  })

  it('still applies a finished draft', async () => {
    const id = await draft('Hand apply finished', [{ type: 'todo', title: 'Ring the venue', config: {} }])
    const coupleId = await couple('Hand Apply Allowed')
    activeUser = owner
    expect((await applyTemplateToCoupleAction({ templateId: id, coupleId, force: false })).ok).toBe(true)
    expect(await enrolments(coupleId, id)).toBe(1)
  })
})

/**
 * The service client, except that reading `templateId`'s steps first runs
 * `edit` (once): the MC's edit landing while an apply snapshots the steps.
 */
function editWhileSnapshotting(templateId: string, edit: () => Promise<void>): SupabaseClient<Database> {
  const real = serviceClient()
  let fired = false
  const wrap = (builder: object, forTemplate: boolean): object =>
    new Proxy(builder, {
      get(target, prop) {
        const value = (target as Record<string | symbol, unknown>)[prop]
        if (prop === 'then' && forTemplate && !fired) {
          fired = true
          return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) =>
            edit().then(() => (value as (a: unknown, b: unknown) => unknown).call(target, ok, bad))
        }
        if (typeof value !== 'function') return value
        return (...args: unknown[]) => {
          const next = (value as (...a: unknown[]) => unknown).apply(target, args)
          const matches = forTemplate || (prop === 'eq' && args[0] === 'template_id' && args[1] === templateId)
          return next && typeof next === 'object' && 'then' in next ? wrap(next as object, matches) : next
        }
      },
    })
  return new Proxy(real, {
    get(target, prop) {
      if (prop === 'from') {
        return (table: string) => {
          const builder = target.from(table as never)
          return table === 'workflow_template_steps' ? wrap(builder, false) : builder
        }
      }
      const value = (target as unknown as Record<string | symbol, unknown>)[prop]
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value
    },
  }) as SupabaseClient<Database>
}

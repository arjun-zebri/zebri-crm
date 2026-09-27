/**
 * Past-dated steps do not fire on apply (Phase 3, Task 19).
 *
 * The "Dubsado gotcha", in the MC's words: I apply my twelve-month
 * wedding workflow to a couple whose wedding is three weeks away, and
 * every step dated before today goes out on the next tick. The rule is
 * that an automated step anchored to the wedding whose date has already
 * passed at apply time is skipped, with an audit line saying why, and
 * nothing sends retroactively.
 *
 * The apply is the real `applyTemplate` and the tick is the real
 * executor against the local database. The transport is captured, so
 * "nothing sends" means no payload reached it.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/email/dispatch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/dispatch')>()
  return { ...actual, dispatchEmail: vi.fn() }
})

/** Template ids to switch off while their apply is in flight. */
const flipDuringApply = new Set<string>()
/** Template ids whose apply a tick lands in the middle of. */
const tickDuringApply = new Set<string>()

// The seam for the insert-to-flip window: `instance_created` is written
// after the instance row exists and before it can go live, on every
// version of applyTemplate. Turning the template off there is exactly an
// MC pressing Turn off while an enrolment is half built.
vi.mock('@/lib/workflows/audit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/workflows/audit')>()
  return {
    ...actual,
    writeAudit: async (...args: Parameters<typeof actual.writeAudit>) => {
      const [client, entry] = args
      if (entry.event === 'instance_created') {
        const templateId = (entry.detail as { templateId?: string } | undefined)?.templateId
        if (templateId && flipDuringApply.has(templateId)) {
          const { error } = await client.rpc('set_workflow_template_status', {
            p_template_id: templateId,
            p_status: 'draft',
          })
          if (error) throw new Error(error.message)
        }
        if (templateId && tickDuringApply.has(templateId)) {
          const { advanceDueSteps: tick } = await import('@/lib/workflows/executor')
          await tick(client, { userId: entry.userId })
        }
      }
      return actual.writeAudit(...args)
    },
  }
})

import { dispatchEmail, type DispatchPayload } from '@/lib/email/dispatch'
import { dispatchPendingEvents } from '@/lib/workflows/dispatcher'
import { advanceDueSteps } from '@/lib/workflows/executor'
import { applyTemplate } from '@/lib/workflows/instantiate'
import type { Json } from '@/types/database'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

const admin = serviceClient()
const DAY = 86_400_000
const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const dispatchMock = vi.mocked(dispatchEmail)
const APPLY_SKIP_REASON = 'its date had already passed when this workflow was started'

let user: TestUser
const users: TestUser[] = []

// A fresh MC per case: the tick runs every due step the MC owns, so a
// step one case left behind would be sent in the next case's tick.
beforeEach(async () => {
  user = await createTestUser({}, PRO)
  users.push(user)
})

afterAll(async () => {
  for (const u of users) await u.cleanup()
})

afterEach(() => {
  flipDuringApply.clear()
  tickDuringApply.clear()
  dispatchMock.mockReset()
})

/** Every payload that reached the transport, in order. */
function captureDispatches(): DispatchPayload[] {
  const captured: DispatchPayload[] = []
  dispatchMock.mockImplementation(async (_sender, payload) => {
    captured.push(payload)
    return { ok: true, messageId: `msg-${captured.length}` }
  })
  return captured
}

/** `YYYY-MM-DD`, `days` from today. */
function dateIn(days: number): string {
  return new Date(Date.now() + days * DAY).toISOString().slice(0, 10)
}

/** A couple with an email address, and optionally a wedding date. */
async function newCouple(name: string, eventDate: string | null): Promise<string> {
  const { data, error } = await admin
    .from('couples')
    .insert({
      user_id: user.id,
      name,
      status: 'Enquiry',
      email: `${name.toLowerCase().replace(/[^a-z]/g, '')}@example.com`,
      ...(eventDate ? { event_date: eventDate } : {}),
    } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

/** A send to the couple, with no quiet hours so a due one goes now. */
function send(subject: string): Json {
  return {
    actionType: 'send_email',
    recipients: { roles: ['primary'], fallback: 'skip' },
    subject,
    body: 'Hi there',
  }
}

const weddingBefore = (amount: number, unit: 'weeks' | 'months'): Json => ({
  mode: 'wedding_relative',
  direction: 'before',
  amount,
  unit,
})

interface StepSpec {
  title: string
  type?: 'action' | 'todo' | 'wait'
  timing: Json
  /** Overrides the default: a send for an action, empty otherwise. */
  config?: Json
}

const chained = (delayAmount: number): Json => ({
  mode: 'after_previous',
  delayAmount,
  unit: 'days',
})

/** A template of top-level steps, in the order given. */
async function template(
  name: string,
  steps: StepSpec[],
  status: 'active' | 'draft' = 'active',
  opts: { applyRuleType?: string } = {},
): Promise<string> {
  const { data, error } = await admin
    .from('workflow_templates')
    .insert({
      user_id: user.id,
      name,
      status,
      quiet_hours_start: null,
      quiet_hours_end: null,
      ...(opts.applyRuleType
        ? { apply_rule_type: opts.applyRuleType, apply_rule_config: {} }
        : {}),
    } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const templateId = (data as { id: string }).id
  // Uniform keys on every row: a ragged array insert silently drops rows.
  const { error: stepsErr } = await admin.from('workflow_template_steps').insert(
    steps.map((s, i) => ({
      template_id: templateId,
      position: i,
      type: s.type ?? 'action',
      title: s.title,
      config: s.config ?? ((s.type ?? 'action') === 'action' ? send(s.title) : {}),
      timing: s.timing,
      parent_step_id: null,
      branch_path: null,
    })) as never,
  )
  if (stepsErr) throw new Error(stepsErr.message)
  return templateId
}

async function stepsOf(instanceId: string) {
  const { data } = await admin
    .from('workflow_steps')
    .select('*')
    .eq('instance_id', instanceId)
    .order('position', { ascending: true })
  return data ?? []
}

async function auditFor(stepId: string): Promise<{ event: string; detail: Json }[]> {
  const { data } = await admin
    .from('workflow_audit_log')
    .select('event, detail')
    .eq('step_id', stepId)
    .order('created_at', { ascending: true })
  return (data ?? []) as { event: string; detail: Json }[]
}

async function instanceRow(id: string) {
  const { data } = await admin
    .from('workflow_instances')
    .select('status, paused_reason')
    .eq('id', id)
    .single()
  return data!
}

async function apply(templateId: string, coupleId: string, triggerEventId?: string) {
  const result = await applyTemplate(admin, {
    userId: user.id,
    templateId,
    coupleId,
    ...(triggerEventId ? { triggerEventId, dedupe: true } : {}),
  })
  if (!('instanceId' in result)) throw new Error(`apply failed: ${result.error}`)
  return result.instanceId
}

describe('applying a long wedding workflow three weeks out', () => {
  it('skips the steps already past, keeps the future one, and sends nothing', async () => {
    const sent = captureDispatches()
    const coupleId = await newCouple('Three Weeks', dateIn(21))
    const t = await template('Twelve month plan', [
      { title: 'Six months out', timing: weddingBefore(6, 'months') },
      { title: 'Three months out', timing: weddingBefore(3, 'months') },
      { title: 'One week out', timing: weddingBefore(1, 'weeks') },
    ])

    const instanceId = await apply(t, coupleId)
    const [six, three, week] = await stepsOf(instanceId)

    expect(six!.status).toBe('skipped')
    expect(three!.status).toBe('skipped')
    for (const skipped of [six!, three!]) {
      const audit = await auditFor(skipped.id)
      expect(audit).toContainEqual({
        event: 'step_skipped',
        detail: { reason: APPLY_SKIP_REASON, dueAt: skipped.due_at },
      })
    }

    expect(week!.status).toBe('pending')
    expect(new Date(week!.due_at!).getTime()).toBeGreaterThan(Date.now())
    expect((await instanceRow(instanceId)).status).toBe('active')

    await advanceDueSteps(admin, { userId: user.id })

    expect(sent).toEqual([])
    expect((await stepsOf(instanceId)).map((s) => s.status)).toEqual([
      'skipped',
      'skipped',
      'pending',
    ])
  })
})

describe('a tick that lands while the apply is being built', () => {
  it('cannot send a past-dated step before it is skipped', async () => {
    const sent = captureDispatches()
    const coupleId = await newCouple('Mid Apply Tick', dateIn(21))
    const t = await template('Raced', [
      { title: 'Six months out', timing: weddingBefore(6, 'months') },
      { title: 'One week out', timing: weddingBefore(1, 'weeks') },
    ])
    tickDuringApply.add(t)

    const instanceId = await apply(t, coupleId)

    expect(sent).toEqual([])
    const [six, week] = await stepsOf(instanceId)
    expect(six!.status).toBe('skipped')
    expect(week!.status).toBe('pending')
    expect((await instanceRow(instanceId)).status).toBe('active')
  })
})

describe('what is never skipped', () => {
  it('a "send immediately" step still goes on the next tick', async () => {
    const sent = captureDispatches()
    const coupleId = await newCouple('Send Now', dateIn(21))
    // Zero calendar days after applying resolves to local midnight
    // today, which is before the apply instant. It is still "now", not
    // "past": only the wedding anchor can be past at apply time.
    const t = await template('Welcome', [
      { title: 'Welcome email', timing: { mode: 'apply_relative', amount: 0, unit: 'days' } },
    ])

    const instanceId = await apply(t, coupleId)
    const [welcome] = await stepsOf(instanceId)
    expect(welcome!.status).toBe('pending')

    await advanceDueSteps(admin, { userId: user.id })

    expect(sent).toHaveLength(1)
    expect(sent[0]!.subject).toBe('Welcome email')
    expect((await stepsOf(instanceId))[0]!.status).toBe('done')
  })

  it('a past-dated to-do stays pending for the MC', async () => {
    const sent = captureDispatches()
    const coupleId = await newCouple('Old To Do', dateIn(21))
    const t = await template('Planning calls', [
      { title: 'Planning call', type: 'todo', timing: weddingBefore(6, 'months') },
    ])

    const instanceId = await apply(t, coupleId)
    const [todo] = await stepsOf(instanceId)

    expect(todo!.status).toBe('pending')
    expect(new Date(todo!.due_at!).getTime()).toBeLessThan(Date.now())
    expect(await auditFor(todo!.id)).toEqual([])

    await advanceDueSteps(admin, { userId: user.id })
    expect(sent).toEqual([])
    expect((await stepsOf(instanceId))[0]!.status).toBe('pending')
  })

  it('a couple with no wedding date: nothing is skipped and nothing sends', async () => {
    const sent = captureDispatches()
    const coupleId = await newCouple('No Date', null)
    const t = await template('Undated', [
      { title: 'Six months out', timing: weddingBefore(6, 'months') },
    ])

    const instanceId = await apply(t, coupleId)
    const [step] = await stepsOf(instanceId)
    expect(step!.status).toBe('pending')
    expect(step!.due_at).toBeNull()

    await advanceDueSteps(admin, { userId: user.id })
    expect(sent).toEqual([])
    expect((await stepsOf(instanceId))[0]!.status).toBe('pending')
  })
})

describe('the follow-ups of a past step', () => {
  it('skips a zero-delay follower and dates a delayed one from the skip', async () => {
    const sent = captureDispatches()
    const coupleId = await newCouple('Followers', dateIn(21))
    const t = await template('Chain', [
      { title: 'Six months out', timing: weddingBefore(6, 'months') },
      { title: 'Straight after', timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' } },
      { title: 'Three days on', timing: { mode: 'after_previous', delayAmount: 3, unit: 'days' } },
    ])

    const instanceId = await apply(t, coupleId)
    const [first, zero, delayed] = await stepsOf(instanceId)

    expect(first!.status).toBe('skipped')
    expect(zero!.status).toBe('skipped')
    expect(await auditFor(zero!.id)).toContainEqual({
      event: 'step_skipped',
      detail: { reason: APPLY_SKIP_REASON, dueAt: zero!.due_at },
    })

    expect(delayed!.status).toBe('pending')
    expect(zero!.completed_at).not.toBeNull()
    expect(new Date(delayed!.due_at!).getTime()).toBe(
      new Date(zero!.completed_at!).getTime() + 3 * DAY,
    )

    await advanceDueSteps(admin, { userId: user.id })
    expect(sent).toEqual([])
  })
})

describe('a workflow turned off while it is being applied', () => {
  async function eventFor(coupleId: string): Promise<string> {
    const { data } = await admin
      .from('automation_events')
      .select('id')
      .eq('couple_id', coupleId)
      .limit(1)
      .single()
    return (data as { id: string }).id
  }

  it('an automatic enrolment ends paused as template_off, and nothing runs', async () => {
    const sent = captureDispatches()
    const coupleId = await newCouple('Race Off', dateIn(21))
    const t = await template('Switched off', [
      { title: 'Welcome email', timing: { mode: 'apply_relative', amount: 0, unit: 'minutes' } },
    ])
    flipDuringApply.add(t)

    const instanceId = await apply(t, coupleId, await eventFor(coupleId))

    expect(await instanceRow(instanceId)).toEqual({
      status: 'paused',
      paused_reason: 'template_off',
    })

    await advanceDueSteps(admin, { userId: user.id })
    expect(sent).toEqual([])
    expect((await stepsOf(instanceId))[0]!.status).toBe('pending')
  })

  it('a manual apply of an active workflow turned off mid-apply ends paused too', async () => {
    const sent = captureDispatches()
    const coupleId = await newCouple('Manual Race', dateIn(21))
    const t = await template('Manual off', [
      { title: 'Welcome email', timing: { mode: 'apply_relative', amount: 0, unit: 'minutes' } },
    ])
    flipDuringApply.add(t)

    const instanceId = await apply(t, coupleId)

    expect(await instanceRow(instanceId)).toEqual({
      status: 'paused',
      paused_reason: 'template_off',
    })
    await advanceDueSteps(admin, { userId: user.id })
    expect(sent).toEqual([])
  })

  it('a manual apply of a draft still goes live', async () => {
    const coupleId = await newCouple('Draft By Hand', dateIn(21))
    const t = await template(
      'Draft',
      [{ title: 'One week out', timing: weddingBefore(1, 'weeks') }],
      'draft',
    )

    const instanceId = await apply(t, coupleId)

    expect(await instanceRow(instanceId)).toEqual({ status: 'active', paused_reason: null })
  })
})

describe('a wait whose own date had already passed at apply', () => {
  // "Wait until 60 days before the wedding", then send a check-in. The
  // wait's timing is ordinary (straight after the apply); its date lives
  // in its config, so the wedding-relative timing rule never saw it. On
  // the next tick the wait found its date gone, finished at once, and
  // the check-in went out three weeks before the wedding.
  const sixtyDaysBefore: Json = {
    mode: 'relative_to_event',
    relative: { amount: 60, unit: 'days', direction: 'before', anchor: 'event_date' },
  }

  it('relative to the wedding: the wait and its zero-delay send are skipped', async () => {
    const sent = captureDispatches()
    const coupleId = await newCouple('Past Wait', dateIn(21))
    const t = await template('Check in', [
      { title: 'Wait for 60 days out', type: 'wait', config: sixtyDaysBefore, timing: chained(0) },
      { title: 'Send check-in', timing: chained(0) },
      { title: 'Three days later', timing: chained(3) },
    ])

    const instanceId = await apply(t, coupleId)
    const [wait, checkIn, later] = await stepsOf(instanceId)

    expect(wait!.status).toBe('skipped')
    expect(await auditFor(wait!.id)).toContainEqual({
      event: 'step_skipped',
      detail: { reason: APPLY_SKIP_REASON, dueAt: wait!.due_at },
    })
    expect(checkIn!.status).toBe('skipped')
    expect(later!.status).toBe('pending')
    expect(new Date(later!.due_at!).getTime()).toBe(
      new Date(checkIn!.completed_at!).getTime() + 3 * DAY,
    )

    await advanceDueSteps(admin, { userId: user.id })
    expect(sent).toEqual([])
  })

  it('until a fixed date: the wait and its zero-delay send are skipped', async () => {
    const sent = captureDispatches()
    const coupleId = await newCouple('Past Until', dateIn(21))
    const t = await template('Until', [
      {
        title: 'Wait until last month',
        type: 'wait',
        config: { mode: 'until_date', untilDate: dateIn(-30) },
        timing: chained(0),
      },
      { title: 'Send check-in', timing: chained(0) },
    ])

    const instanceId = await apply(t, coupleId)
    const [wait, checkIn] = await stepsOf(instanceId)

    expect(wait!.status).toBe('skipped')
    expect(checkIn!.status).toBe('skipped')
    await advanceDueSteps(admin, { userId: user.id })
    expect(sent).toEqual([])
  })

  it('a wait for a date still ahead is left to sleep until it', async () => {
    const sent = captureDispatches()
    const coupleId = await newCouple('Future Wait', dateIn(90))
    const t = await template('Future', [
      { title: 'Wait for 60 days out', type: 'wait', config: sixtyDaysBefore, timing: chained(0) },
      { title: 'Send check-in', timing: chained(0) },
    ])

    const instanceId = await apply(t, coupleId)
    await advanceDueSteps(admin, { userId: user.id })

    const [wait, checkIn] = await stepsOf(instanceId)
    expect(wait!.status).toBe('waiting')
    expect(checkIn!.status).toBe('pending')
    expect(sent).toEqual([])
  })

  it('a duration wait still sleeps from now', async () => {
    const sent = captureDispatches()
    const coupleId = await newCouple('Duration Wait', dateIn(21))
    const t = await template('Duration', [
      {
        title: 'Wait an hour',
        type: 'wait',
        config: { mode: 'duration', durationMinutes: 60 },
        timing: chained(0),
      },
      { title: 'Send check-in', timing: chained(0) },
    ])

    const instanceId = await apply(t, coupleId)
    expect((await stepsOf(instanceId))[0]!.status).toBe('pending')

    await advanceDueSteps(admin, { userId: user.id })

    const [wait, checkIn] = await stepsOf(instanceId)
    expect(wait!.status).toBe('waiting')
    expect(new Date(wait!.due_at!).getTime()).toBeGreaterThan(Date.now() + 50 * 60_000)
    expect(checkIn!.status).toBe('pending')
    expect(sent).toEqual([])
  })
})

describe('the dispatcher counts an enrolment the switch caught mid-apply', () => {
  it('as a quiet skip, not an opened instance', async () => {
    const t = await template(
      'Dispatched off',
      [{ title: 'Welcome email', timing: { mode: 'apply_relative', amount: 0, unit: 'minutes' } }],
      'active',
      { applyRuleType: 'on_couple_created' },
    )
    await dispatchPendingEvents(admin, 5000, { userId: user.id })
    flipDuringApply.add(t)
    await newCouple('Dispatch Race', dateIn(21))

    const result = await dispatchPendingEvents(admin, 5000, { userId: user.id })

    expect(result.matchedTemplates).toBe(1)
    expect(result.openedInstances).toBe(0)
    expect(result.skippedOffTemplates).toBe(1)
  })
})

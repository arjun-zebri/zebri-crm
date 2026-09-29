/**
 * `start_workflow`: the step that moves a couple on to another workflow.
 *
 * The handler is a thin, careful wrapper over `applyTemplate`. These pin
 * the refusals (no couple, itself, too deep, deleted, turned off), that
 * "already on this couple" is a success rather than a stuck step, that
 * the next workflow opens one chain level deeper, and that the target is
 * read owner-scoped (the engine runs on the service role, so RLS does
 * not do it).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RunContext } from '@/types/automations'

import { called, fakeSupabase, type Recorded, type Reply } from '../../workflows/fake-supabase'

const applyTemplate = vi.fn()
const sendAlert = vi.fn(async () => undefined)
let target: Reply = { data: null, error: null }
let log: Recorded[] = []

vi.mock('@/lib/workflows/instantiate', () => ({ applyTemplate: (...a: unknown[]) => applyTemplate(...a) }))
vi.mock('@/lib/alerts/send-alert', () => ({ sendAlert: (...a: unknown[]) => sendAlert(...(a as [])) }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    const fake = fakeSupabase(() => target)
    log = fake.log
    return fake.client
  },
}))

const { actionRegistry } = await import('@/lib/automations/actions')
const spec = actionRegistry.start_workflow!

const NEXT = '7f2c1e58-0000-4000-8000-000000000002'

function ctx(over: Partial<RunContext> = {}): RunContext {
  return {
    userId: 'user-1',
    automationId: 'template-self',
    runId: 'instance-1',
    instanceId: 'instance-1',
    stepId: 'step-1',
    coupleId: 'couple-1',
    ...over,
  } as RunContext
}

async function run(config: Record<string, unknown>, c: RunContext = ctx()) {
  const parsed = spec.configSchema.parse(config)
  return spec.handler(c, parsed)
}

beforeEach(() => {
  applyTemplate.mockReset()
  sendAlert.mockClear()
  target = { data: { id: NEXT, name: 'Planning', status: 'active' }, error: null }
})

describe('start_workflow config', () => {
  it('refuses a step with no workflow chosen, naming the field', async () => {
    expect(spec.configSchema.safeParse({ endCurrent: true }).success).toBe(false)
    const { validateStepConfig } = await import('@/lib/workflows/step-config-validation')
    const check = validateStepConfig('action', { actionType: 'start_workflow', workflow: '' })
    expect(check.ok === false && check.error).toContain('Workflow is required')
  })

  it('ends the current workflow unless told otherwise', () => {
    expect(spec.configSchema.parse({ workflow: NEXT })).toMatchObject({ endCurrent: true })
    expect(spec.configSchema.parse({ workflow: NEXT, endCurrent: false })).toMatchObject({
      endCurrent: false,
    })
  })
})

describe('start_workflow handler', () => {
  it('opens the next workflow on the couple, one chain level deeper', async () => {
    applyTemplate.mockResolvedValue({ instanceId: 'instance-2' })
    const result = await run({ workflow: NEXT }, ctx({ chainDepth: 2 }))
    expect(result).toEqual({
      kind: 'ok',
      output: {
        workflow_id: NEXT,
        workflow_name: 'Planning',
        ended_workflow: true,
        started: true,
        instance_id: 'instance-2',
      },
    })
    expect(applyTemplate).toHaveBeenCalledWith(expect.anything(), {
      userId: 'user-1',
      templateId: NEXT,
      coupleId: 'couple-1',
      dedupe: true,
      chainDepth: 3,
    })
  })

  it('reads the target scoped to the MC who owns this workflow', async () => {
    applyTemplate.mockResolvedValue({ instanceId: 'instance-2' })
    await run({ workflow: NEXT })
    const read = log.find((q) => q.table === 'workflow_templates')
    expect(read && called(read.calls, 'eq', 'user_id')).toBe(true)
    expect(read?.calls.find((c) => c.method === 'eq' && c.args[0] === 'user_id')?.args[1]).toBe('user-1')
  })

  it('reports ended_workflow false when the MC keeps this one going', async () => {
    applyTemplate.mockResolvedValue({ instanceId: 'instance-2' })
    const result = await run({ workflow: NEXT, endCurrent: false })
    expect(result.kind === 'ok' && result.output).toMatchObject({ ended_workflow: false })
  })

  it('treats a workflow already on the couple as done, not failed', async () => {
    applyTemplate.mockResolvedValue({ error: 'already applied to this couple' })
    const result = await run({ workflow: NEXT })
    expect(result).toMatchObject({
      kind: 'ok',
      output: { started: false, reason: 'already_applied', ended_workflow: true },
    })
  })

  it('refuses without retrying when the next workflow is turned off', async () => {
    applyTemplate.mockResolvedValue({ error: 'template is off', skipped: 'template_off' })
    const result = await run({ workflow: NEXT })
    expect(result).toEqual({
      kind: 'error',
      message: 'Planning is turned off, so it could not start. Turn it on, then try again.',
      recoverable: false,
    })
  })

  it('leaves a failed build to the retry', async () => {
    applyTemplate.mockResolvedValue({ error: 'could not create instance' })
    const result = await run({ workflow: NEXT })
    expect(result).toMatchObject({ kind: 'error' })
    expect(result.kind === 'error' && result.recoverable).toBeUndefined()
  })

  it('refuses a workflow that is not the MC’s, or was deleted, without applying', async () => {
    for (const reply of [
      { data: null, error: null },
      { data: { id: NEXT, name: 'Planning', status: 'archived' }, error: null },
    ]) {
      target = reply
      const result = await run({ workflow: NEXT })
      expect(result).toMatchObject({ kind: 'error', recoverable: false })
    }
    expect(applyTemplate).not.toHaveBeenCalled()
  })

  it('refuses a workflow starting itself', async () => {
    const result = await run({ workflow: 'template-self' })
    expect(result).toMatchObject({ kind: 'error', recoverable: false })
    expect(applyTemplate).not.toHaveBeenCalled()
  })

  it('refuses when there is no couple to move', async () => {
    const result = await run({ workflow: NEXT }, ctx({ coupleId: null }))
    expect(result).toMatchObject({ kind: 'error', recoverable: false })
    expect(applyTemplate).not.toHaveBeenCalled()
  })

  it('stops a chain past its depth limit and alerts', async () => {
    const result = await run({ workflow: NEXT }, ctx({ chainDepth: 5 }))
    expect(result).toMatchObject({ kind: 'error', recoverable: false })
    expect(applyTemplate).not.toHaveBeenCalled()
    expect(sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'workflow_chain_failed', reason: 'depth_limit', instanceId: 'instance-1' }),
    )
  })
})

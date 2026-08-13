/**
 * AI copilot tool executor tests.
 *
 * Executors are the only mutation path the copilot has. These tests
 * prove the safety rails with a scripted Supabase mock:
 *
 *   - mutations refuse anything that isn't a draft automation,
 *   - configs that fail engine validation never reach the DB,
 *   - inserts respect the engine's slot model (sequence = siblings
 *     ordered by position; parent_action_id + branch_path are set
 *     together only for branch children — the DB's
 *     automation_actions_branch_consistency constraint),
 *   - reads return the shape the model is promised.
 */
import { describe, expect, it } from 'vitest'

import { executeCopilotTool } from '@/lib/automations/ai-copilot/tool-executors'

/* ─── scripted supabase mock ─────────────────────────────────────── */

interface Call {
  table: string
  op: 'select' | 'insert' | 'update' | 'delete'
  values?: unknown
  filters: Record<string, unknown>
  single?: boolean
}

type Script = (call: Call) => { data?: unknown; error?: { message: string } | null }

/** Chainable, thenable stand-in for the supabase-js query builder. */
function mockSupabase(script: Script) {
  const calls: Call[] = []
  function builder(table: string) {
    const call: Call = { table, op: 'select', filters: {} }
    const q: Record<string, unknown> = {}
    const chain = (fn: (...a: unknown[]) => void) =>
      (...a: unknown[]) => {
        fn(...a)
        return q
      }
    q.select = chain(() => {})
    q.insert = chain((v) => {
      call.op = 'insert'
      call.values = v
    })
    q.update = chain((v) => {
      call.op = 'update'
      call.values = v
    })
    q.delete = chain(() => {
      call.op = 'delete'
    })
    q.eq = chain((k, v) => {
      call.filters[k as string] = v
    })
    q.is = chain((k, v) => {
      call.filters[k as string] = v
    })
    q.order = chain(() => {})
    q.limit = chain(() => {})
    q.maybeSingle = chain(() => {
      call.single = true
    })
    q.single = chain(() => {
      call.single = true
    })
    q.then = (resolve: (r: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      calls.push(call)
      try {
        const out = script(call)
        return Promise.resolve({ data: out.data ?? null, error: out.error ?? null }).then(
          resolve,
          reject,
        )
      } catch (e) {
        return Promise.reject(e).then(resolve, reject)
      }
    }
    return q
  }
  return { client: { from: builder } as never, calls }
}

const AUTOMATION_ID = '00000000-0000-4000-8000-000000000001'
const ACTION_A = '00000000-0000-4000-8000-00000000000a'
const ACTION_B = '00000000-0000-4000-8000-00000000000b'
const BRANCH_ID = '00000000-0000-4000-8000-00000000000c'

function draftAutomation(status = 'draft') {
  return {
    id: AUTOMATION_ID,
    status,
    name: 'Enquiry follow-up',
    trigger_type: 'new_enquiry',
    trigger_config: {},
  }
}

/** Two top-level steps: A at 100, B at 200 (the engine's slot model). */
function topLevelChain() {
  return [
    { id: ACTION_A, position: 100, type: 'send_email', parent_action_id: null, branch_path: null },
    { id: ACTION_B, position: 200, type: 'create_task', parent_action_id: null, branch_path: null },
  ]
}

/* ─── draft guard ────────────────────────────────────────────────── */

describe('executeCopilotTool — draft guard', () => {
  it('refuses set_trigger on an active automation', async () => {
    const { client } = mockSupabase((call) => {
      if (call.table === 'automations' && call.op === 'select') {
        return { data: draftAutomation('active') }
      }
      throw new Error(`unexpected call ${call.table}/${call.op}`)
    })
    const res = await executeCopilotTool(
      'set_trigger',
      { triggerType: 'new_enquiry', triggerConfig: {} },
      { automationId: AUTOMATION_ID, supabase: client },
    )
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/pause|draft/i)
  })

  it('refuses add_action when the automation is not found (RLS miss)', async () => {
    const { client } = mockSupabase((call) => {
      if (call.table === 'automations') return { data: null }
      throw new Error(`unexpected call ${call.table}/${call.op}`)
    })
    const res = await executeCopilotTool(
      'add_action',
      { type: 'create_task', config: { title: 'Call them' } },
      { automationId: AUTOMATION_ID, supabase: client },
    )
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/not found/i)
  })
})

/* ─── add_action ─────────────────────────────────────────────────── */

describe('executeCopilotTool — add_action', () => {
  it('rejects an invalid config before any write', async () => {
    const { client, calls } = mockSupabase((call) => {
      if (call.table === 'automations') return { data: draftAutomation() }
      if (call.table === 'automation_actions' && call.op === 'select') return { data: [] }
      throw new Error(`unexpected call ${call.table}/${call.op}`)
    })
    const res = await executeCopilotTool(
      'add_action',
      { type: 'wait', config: { mode: 'someday' } },
      { automationId: AUTOMATION_ID, supabase: client },
    )
    expect(res.ok).toBe(false)
    expect(calls.some((c) => c.op === 'insert')).toBe(false)
  })

  it('appends to the top-level slot with both parent and branch null', async () => {
    const inserts: Call[] = []
    const { client } = mockSupabase((call) => {
      if (call.table === 'automations') return { data: draftAutomation() }
      if (call.table === 'automation_actions' && call.op === 'select') {
        return { data: topLevelChain() }
      }
      if (call.table === 'automation_actions' && call.op === 'insert') {
        inserts.push(call)
        return { data: { id: 'new-id' } }
      }
      throw new Error(`unexpected call ${call.table}/${call.op}`)
    })
    const res = await executeCopilotTool(
      'add_action',
      { type: 'wait', config: { mode: 'duration', durationMinutes: 60 } },
      { automationId: AUTOMATION_ID, supabase: client },
    )
    expect(res.ok).toBe(true)
    const inserted = inserts[0]!.values as Record<string, unknown>
    // branch_consistency: top-level rows carry NEITHER field
    expect(inserted.parent_action_id).toBeNull()
    expect(inserted.branch_path).toBeNull()
    expect(inserted.position).toBe(300)
  })

  it('inserts after a mid-chain step by shifting later siblings', async () => {
    const inserts: Call[] = []
    const updates: Call[] = []
    const { client } = mockSupabase((call) => {
      if (call.table === 'automations') return { data: draftAutomation() }
      if (call.table === 'automation_actions' && call.op === 'select') {
        return { data: topLevelChain() }
      }
      if (call.table === 'automation_actions' && call.op === 'insert') {
        inserts.push(call)
        return { data: { id: 'new-id' } }
      }
      if (call.table === 'automation_actions' && call.op === 'update') {
        updates.push(call)
        return { data: null }
      }
      throw new Error(`unexpected call ${call.table}/${call.op}`)
    })
    const res = await executeCopilotTool(
      'add_action',
      {
        type: 'wait',
        config: { mode: 'duration', durationMinutes: 60 },
        afterActionId: ACTION_A,
      },
      { automationId: AUTOMATION_ID, supabase: client },
    )
    expect(res.ok).toBe(true)
    // B (position 200 > A's 100) shifted out of the way…
    expect(updates).toHaveLength(1)
    expect(updates[0]!.filters.id).toBe(ACTION_B)
    expect((updates[0]!.values as Record<string, unknown>).position).toBe(400)
    // …and the new step lands in A's slot right after A.
    const inserted = inserts[0]!.values as Record<string, unknown>
    expect(inserted.parent_action_id).toBeNull()
    expect(inserted.branch_path).toBeNull()
    expect(inserted.position).toBe(200)
  })

  it('appends into a branch side when afterActionId is a branch + branchPath', async () => {
    const inserts: Call[] = []
    const { client } = mockSupabase((call) => {
      if (call.table === 'automations') return { data: draftAutomation() }
      if (call.table === 'automation_actions' && call.op === 'select') {
        return {
          data: [
            { id: BRANCH_ID, position: 100, type: 'branch', parent_action_id: null, branch_path: null },
            { id: ACTION_A, position: 100, type: 'send_email', parent_action_id: BRANCH_ID, branch_path: 'yes' },
          ],
        }
      }
      if (call.table === 'automation_actions' && call.op === 'insert') {
        inserts.push(call)
        return { data: { id: 'new-id' } }
      }
      throw new Error(`unexpected call ${call.table}/${call.op}`)
    })
    const res = await executeCopilotTool(
      'add_action',
      {
        type: 'create_task',
        config: { title: 'Chase payment' },
        afterActionId: BRANCH_ID,
        branchPath: 'yes',
      },
      { automationId: AUTOMATION_ID, supabase: client },
    )
    expect(res.ok).toBe(true)
    const inserted = inserts[0]!.values as Record<string, unknown>
    expect(inserted.parent_action_id).toBe(BRANCH_ID)
    expect(inserted.branch_path).toBe('yes')
    expect(inserted.position).toBe(200)
  })

  it('inserts at the head of the main flow with atStart', async () => {
    // "Add a wait between the trigger and the first action" — the
    // exact request that had no correct move before atStart existed.
    const inserts: Call[] = []
    const { client } = mockSupabase((call) => {
      if (call.table === 'automations') return { data: draftAutomation() }
      if (call.table === 'automation_actions' && call.op === 'select') {
        return { data: topLevelChain() }
      }
      if (call.table === 'automation_actions' && call.op === 'insert') {
        inserts.push(call)
        return { data: { id: 'new-id' } }
      }
      throw new Error(`unexpected call ${call.table}/${call.op}`)
    })
    const res = await executeCopilotTool(
      'add_action',
      { type: 'wait', config: { mode: 'duration', durationMinutes: 15 }, atStart: true },
      { automationId: AUTOMATION_ID, supabase: client },
    )
    expect(res.ok).toBe(true)
    const inserted = inserts[0]!.values as Record<string, unknown>
    expect(inserted.parent_action_id).toBeNull()
    expect(inserted.branch_path).toBeNull()
    // Before A (position 100), so it runs first.
    expect(inserted.position).toBeLessThan(100)
  })

  it('rejects atStart combined with a non-branch afterActionId', async () => {
    const { client, calls } = mockSupabase((call) => {
      if (call.table === 'automations') return { data: draftAutomation() }
      if (call.table === 'automation_actions' && call.op === 'select') {
        return { data: topLevelChain() }
      }
      throw new Error(`unexpected call ${call.table}/${call.op}`)
    })
    const res = await executeCopilotTool(
      'add_action',
      {
        type: 'wait',
        config: { mode: 'duration', durationMinutes: 15 },
        atStart: true,
        afterActionId: ACTION_A,
      },
      { automationId: AUTOMATION_ID, supabase: client },
    )
    expect(res.ok).toBe(false)
    expect(calls.some((c) => c.op === 'insert')).toBe(false)
  })

  it('demands a branchPath when afterActionId is a branch', async () => {
    const { client, calls } = mockSupabase((call) => {
      if (call.table === 'automations') return { data: draftAutomation() }
      if (call.table === 'automation_actions' && call.op === 'select') {
        return {
          data: [
            { id: BRANCH_ID, position: 100, type: 'branch', parent_action_id: null, branch_path: null },
          ],
        }
      }
      throw new Error(`unexpected call ${call.table}/${call.op}`)
    })
    const res = await executeCopilotTool(
      'add_action',
      { type: 'create_task', config: { title: 'x' }, afterActionId: BRANCH_ID },
      { automationId: AUTOMATION_ID, supabase: client },
    )
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/branchPath/i)
    expect(calls.some((c) => c.op === 'insert')).toBe(false)
  })
})

/* ─── update_action_config ───────────────────────────────────────── */

describe('executeCopilotTool — update_action_config', () => {
  it('validates the new config against the row type', async () => {
    const { client, calls } = mockSupabase((call) => {
      if (call.table === 'automations') return { data: draftAutomation() }
      if (call.table === 'automation_actions' && call.op === 'select') {
        return { data: { id: ACTION_A, type: 'wait', config: { mode: 'duration', durationMinutes: 5 } } }
      }
      throw new Error(`unexpected call ${call.table}/${call.op}`)
    })
    const res = await executeCopilotTool(
      'update_action_config',
      { actionId: ACTION_A, config: { mode: 'nonsense' } },
      { automationId: AUTOMATION_ID, supabase: client },
    )
    expect(res.ok).toBe(false)
    expect(calls.some((c) => c.op === 'update')).toBe(false)
  })
})

/* ─── remove_action ──────────────────────────────────────────────── */

describe('executeCopilotTool — remove_action', () => {
  it('re-slots a branch child into the branch node slot, then deletes', async () => {
    const ops: Call[] = []
    const { client } = mockSupabase((call) => {
      if (call.table === 'automations') return { data: draftAutomation() }
      if (call.table === 'automation_actions' && call.op === 'select') {
        return {
          data: [
            { id: BRANCH_ID, position: 100, type: 'branch', parent_action_id: null, branch_path: null },
            { id: ACTION_A, position: 100, type: 'send_email', parent_action_id: BRANCH_ID, branch_path: 'yes' },
          ],
        }
      }
      ops.push(call)
      return { data: null }
    })
    const res = await executeCopilotTool(
      'remove_action',
      { actionId: BRANCH_ID },
      { automationId: AUTOMATION_ID, supabase: client },
    )
    expect(res.ok).toBe(true)
    const update = ops.find((c) => c.op === 'update')
    const del = ops.find((c) => c.op === 'delete')
    expect(update).toBeDefined()
    expect(update!.filters.id).toBe(ACTION_A)
    // Inherits the removed branch node's slot: both fields null together
    // (the branch_consistency constraint).
    expect((update!.values as Record<string, unknown>).parent_action_id).toBeNull()
    expect((update!.values as Record<string, unknown>).branch_path).toBeNull()
    expect(del).toBeDefined()
    expect(del!.filters.id).toBe(BRANCH_ID)
  })
})

/* ─── read_automation ────────────────────────────────────────────── */

describe('executeCopilotTool — read_automation', () => {
  it('returns trigger and ordered actions without requiring draft status', async () => {
    const { client } = mockSupabase((call) => {
      if (call.table === 'automations') return { data: draftAutomation('active') }
      if (call.table === 'automation_actions') {
        return {
          data: [
            { id: ACTION_A, position: 100, type: 'send_email', parent_action_id: null, branch_path: null, config: {}, label: null },
          ],
        }
      }
      throw new Error(`unexpected call ${call.table}/${call.op}`)
    })
    const res = await executeCopilotTool(
      'read_automation',
      {},
      { automationId: AUTOMATION_ID, supabase: client },
    )
    expect(res.ok).toBe(true)
    if (res.ok) {
      const data = res.data as { trigger: { type: string }; actions: unknown[] }
      expect(data.trigger.type).toBe('new_enquiry')
      expect(data.actions).toHaveLength(1)
    }
  })
})

describe('executeCopilotTool — list_email_templates', () => {
  it('returns unarchived templates as id + name pairs', async () => {
    const { client, calls } = mockSupabase((call) => {
      if (call.table === 'email_templates' && call.op === 'select') {
        return {
          data: [
            { id: 't1', name: 'Enquiry acknowledgement' },
            { id: 't2', name: 'Welcome email' },
          ],
        }
      }
      throw new Error(`unexpected call ${call.table}/${call.op}`)
    })
    const res = await executeCopilotTool(
      'list_email_templates',
      {},
      { automationId: AUTOMATION_ID, supabase: client },
    )
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data).toEqual([
        { id: 't1', name: 'Enquiry acknowledgement' },
        { id: 't2', name: 'Welcome email' },
      ])
    }
    // archived templates are filtered out at the query
    expect(calls[0]!.filters.archived_at).toBeNull()
  })
})

describe('executeCopilotTool — unknown tool', () => {
  it('returns an error for a tool name outside the set', async () => {
    const { client } = mockSupabase(() => ({ data: null }))
    const res = await executeCopilotTool(
      'activate_automation' as never,
      {},
      { automationId: AUTOMATION_ID, supabase: client },
    )
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/unknown tool/i)
  })
})

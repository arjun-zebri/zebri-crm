/**
 * AI copilot integration tests — the route's security gates and the
 * usage-cap machinery, against local Supabase with real RLS.
 *
 * The server Supabase client is mocked to whichever test client the
 * scenario needs; the Anthropic client is scripted (no network). What
 * is real: auth users, RLS policies, the ai_copilot_usage RPC, and
 * the automation rows the executors mutate.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  anonClient,
  createTestUser,
  serviceClient,
  type DbClient,
  type TestUser,
} from '../helpers/supabase'

// Route sees whichever client the scenario installs here.
let currentClient: DbClient

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => currentClient),
}))

vi.mock('@/lib/alerts/send-alert', () => ({
  sendAlert: vi.fn(async () => undefined),
}))

// Scripted Claude: each entry is one Anthropic-shaped response.
let scriptedResponses: Array<Record<string, unknown>> = []
let scriptIndex = 0

vi.mock('@/lib/automations/ai-copilot/llm-client', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  return {
    ...original,
    getAnthropicClient: () => ({
      create: async () => {
        const response =
          scriptedResponses[Math.min(scriptIndex, scriptedResponses.length - 1)] ?? {
            content: [{ type: 'text', text: 'ok' }],
            stop_reason: 'end_turn',
          }
        scriptIndex += 1
        return response
      },
    }),
  }
})

// eslint-disable-next-line import/order
import { DAILY_MESSAGE_CAP, POST } from '@/app/api/ai/automation-copilot/route'
// eslint-disable-next-line import/order
import { NextRequest } from 'next/server'

const subscribed = { account_type: 'vendor', is_subscribed: true }
const cleanup: Array<() => Promise<void>> = []
afterAll(async () => {
  await Promise.all(cleanup.map((f) => f().catch(() => undefined)))
})

beforeEach(() => {
  scriptedResponses = [{ content: [{ type: 'text', text: 'All set.' }], stop_reason: 'end_turn' }]
  scriptIndex = 0
})

async function makeUserWithAutomation(
  appMetadata: Record<string, unknown> = subscribed,
): Promise<{ user: TestUser; automationId: string }> {
  const user = await createTestUser({}, appMetadata)
  cleanup.push(user.cleanup)
  const admin = serviceClient()
  const { data, error } = await admin
    .from('automations')
    .insert({
      user_id: user.id,
      name: 'Copilot test automation',
      trigger_type: 'new_enquiry',
      trigger_config: {},
      status: 'draft',
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'automation insert failed')
  return { user, automationId: data.id }
}

function req(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/ai/automation-copilot', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const message = (automationId: string, content = 'Add a task step') => ({
  automationId,
  messages: [{ role: 'user', content }],
})

describe('gates', () => {
  it('401s an unauthenticated caller', async () => {
    currentClient = anonClient()
    const res = await POST(req(message('00000000-0000-4000-8000-000000000001')))
    expect(res.status).toBe(401)
  })

  it('403s a signed-in but unsubscribed user', async () => {
    const { user, automationId } = await makeUserWithAutomation({ account_type: 'vendor' })
    currentClient = user.client
    const res = await POST(req(message(automationId)))
    expect(res.status).toBe(403)
  })

  it("404s another tenant's automation (RLS)", async () => {
    const { automationId } = await makeUserWithAutomation()
    const intruder = await createTestUser({}, subscribed)
    cleanup.push(intruder.cleanup)
    currentClient = intruder.client
    const res = await POST(req(message(automationId)))
    expect(res.status).toBe(404)
  })

  it('429s once the daily cap is reached', async () => {
    const { user, automationId } = await makeUserWithAutomation()
    const admin = serviceClient()
    const today = new Date().toISOString().slice(0, 10)
    await admin
      .from('ai_copilot_usage')
      .insert({ user_id: user.id, day: today, message_count: DAILY_MESSAGE_CAP })
    currentClient = user.client
    const res = await POST(req(message(automationId)))
    expect(res.status).toBe(429)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/daily/i)
  })

  it('429s a burst past the per-minute limit', async () => {
    const { user, automationId } = await makeUserWithAutomation()
    currentClient = user.client
    let limited = false
    for (let i = 0; i < 21 && !limited; i += 1) {
      const res = await POST(req(message(automationId)))
      if (res.status === 429) limited = true
      else await res.text() // drain the stream
    }
    expect(limited).toBe(true)
  })
})

describe('tool loop against real RLS', () => {
  it('executes a scripted add_action and lands the row', async () => {
    const { user, automationId } = await makeUserWithAutomation()
    currentClient = user.client
    scriptedResponses = [
      {
        content: [
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'add_action',
            input: {
              type: 'create_task',
              config: { title: 'Call the couple' },
              label: 'Follow-up task',
            },
          },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [{ type: 'text', text: 'Added a follow-up task step.' }],
        stop_reason: 'end_turn',
      },
    ]

    const res = await POST(req(message(automationId)))
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('"type":"tool_result"')
    expect(text).toContain('"ok":true')
    expect(text).toContain('"type":"done"')

    const admin = serviceClient()
    const { data: actions } = await admin
      .from('automation_actions')
      .select('type, label, config')
      .eq('automation_id', automationId)
    expect(actions).toHaveLength(1)
    expect(actions![0]!.type).toBe('create_task')

    // and the daily counter advanced for this user
    const { data: usage } = await admin
      .from('ai_copilot_usage')
      .select('message_count')
      .eq('user_id', user.id)
    expect(usage![0]!.message_count).toBe(1)
  })

  it('chains a second step via afterActionId without tripping branch_consistency', async () => {
    // Regression: the DB enforces parent_action_id + branch_path set
    // together (branch children) or neither (sequenced steps). The
    // executor must express "after step X" through position order, not
    // parent linkage — a live bug caught by this exact constraint.
    const { user, automationId } = await makeUserWithAutomation()
    currentClient = user.client
    const admin = serviceClient()
    const { data: first } = await admin
      .from('automation_actions')
      .insert({
        automation_id: automationId,
        position: 100,
        type: 'send_email',
        config: {},
        parent_action_id: null,
        branch_path: null,
      })
      .select('id')
      .single()
    scriptedResponses = [
      {
        content: [
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'add_action',
            input: {
              type: 'create_task',
              config: { title: 'Follow up' },
              afterActionId: first!.id,
            },
          },
        ],
        stop_reason: 'tool_use',
      },
      { content: [{ type: 'text', text: 'Chained.' }], stop_reason: 'end_turn' },
    ]

    const res = await POST(req(message(automationId, 'add a follow-up task after the email')))
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('"ok":true')

    const { data: actions } = await admin
      .from('automation_actions')
      .select('type, position, parent_action_id, branch_path')
      .eq('automation_id', automationId)
      .order('position', { ascending: true })
    expect(actions).toHaveLength(2)
    expect(actions![1]!.type).toBe('create_task')
    expect(actions![1]!.parent_action_id).toBeNull()
    expect(actions![1]!.branch_path).toBeNull()
    expect(actions![1]!.position).toBeGreaterThan(actions![0]!.position)
  })

  it('refuses an invalid config and writes nothing', async () => {
    const { user, automationId } = await makeUserWithAutomation()
    currentClient = user.client
    scriptedResponses = [
      {
        content: [
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'add_action',
            input: { type: 'wait', config: { mode: 'someday' } },
          },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [{ type: 'text', text: 'That config was invalid.' }],
        stop_reason: 'end_turn',
      },
    ]
    const res = await POST(req(message(automationId)))
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('"ok":false')
    const admin = serviceClient()
    const { data: actions } = await admin
      .from('automation_actions')
      .select('id')
      .eq('automation_id', automationId)
    expect(actions).toHaveLength(0)
  })
})

describe('ai_copilot_usage hardening', () => {
  it('cannot be written directly by its owner (no insert/update/delete policies)', async () => {
    const user = await createTestUser({}, subscribed)
    cleanup.push(user.cleanup)
    const today = new Date().toISOString().slice(0, 10)
    const { error: insertError } = await user.client
      .from('ai_copilot_usage')
      .insert({ user_id: user.id, day: today, message_count: 0 })
    expect(insertError).not.toBeNull()
  })

  it("hides other tenants' usage rows from the owner-select policy", async () => {
    const a = await createTestUser({}, subscribed)
    const b = await createTestUser({}, subscribed)
    cleanup.push(a.cleanup, b.cleanup)
    const admin = serviceClient()
    const today = new Date().toISOString().slice(0, 10)
    await admin.from('ai_copilot_usage').insert({ user_id: a.id, day: today, message_count: 5 })
    const { data } = await b.client.from('ai_copilot_usage').select('user_id')
    expect(data).toEqual([])
  })

  it('increments per calling user via the RPC and rejects anon', async () => {
    const user = await createTestUser({}, subscribed)
    cleanup.push(user.cleanup)
    const first = await user.client.rpc('increment_ai_copilot_usage')
    const second = await user.client.rpc('increment_ai_copilot_usage')
    expect(first.data).toBe(1)
    expect(second.data).toBe(2)

    const anon = await anonClient().rpc('increment_ai_copilot_usage')
    expect(anon.error).not.toBeNull()
  })
})

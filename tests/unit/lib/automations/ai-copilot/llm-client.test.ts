/**
 * Function-calling loop tests (Anthropic Messages API).
 *
 * `runCopilotTurn` drives the Claude tool loop: emit text, execute
 * `tool_use` blocks through the executor, return all `tool_result`
 * blocks in a single user message, repeat until the model stops. The
 * Anthropic client is injected, so these tests script responses and
 * assert on the emitted event sequence and the message history handed
 * back to the model.
 */
import { describe, expect, it } from 'vitest'

import {
  buildCopilotToolDefinitions,
  runCopilotTurn,
  type AnthropicMessageLike,
} from '@/lib/automations/ai-copilot/llm-client'

interface ScriptedResponse {
  content: Array<Record<string, unknown>>
  stop_reason: string
}

function fakeClient(responses: ScriptedResponse[]) {
  const requests: Array<Record<string, unknown>> = []
  let i = 0
  return {
    requests,
    client: {
      create: async (req: Record<string, unknown>): Promise<AnthropicMessageLike> => {
        requests.push(req)
        const response = responses[Math.min(i, responses.length - 1)]!
        i += 1
        return response as unknown as AnthropicMessageLike
      },
    },
  }
}

describe('buildCopilotToolDefinitions', () => {
  it('exposes the five phase-A tools with Anthropic input_schema', () => {
    const tools = buildCopilotToolDefinitions()
    const names = tools.map((t) => t.name).sort()
    expect(names).toEqual([
      'add_action',
      'list_email_templates',
      'read_automation',
      'remove_action',
      'set_trigger',
      'update_action_config',
    ])
    for (const t of tools) {
      expect(t.description.length).toBeGreaterThan(0)
      expect(t.input_schema).toBeTypeOf('object')
    }
  })
})

describe('runCopilotTurn', () => {
  it('executes tool_use blocks and feeds results back until end_turn', async () => {
    const { client, requests } = fakeClient([
      {
        content: [
          { type: 'text', text: 'Adding that now.' },
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'add_action',
            input: { type: 'create_task', config: { title: 'Call' } },
          },
        ],
        stop_reason: 'tool_use',
      },
      { content: [{ type: 'text', text: 'Added a task step.' }], stop_reason: 'end_turn' },
    ])

    const events: Array<Record<string, unknown>> = []
    const executed: Array<{ name: string; input: unknown }> = []

    await runCopilotTurn({
      client,
      system: 'sys',
      messages: [{ role: 'user', content: 'add a task' }],
      executeTool: async (name, input) => {
        executed.push({ name, input })
        return { ok: true, data: { id: 'a1' } }
      },
      onEvent: (e) => events.push(e as Record<string, unknown>),
    })

    expect(executed).toEqual([
      { name: 'add_action', input: { type: 'create_task', config: { title: 'Call' } } },
    ])
    expect(events.map((e) => e.type)).toEqual(['message', 'tool_call', 'tool_result', 'message'])

    // second request: assistant turn echoed, then ONE user message
    // whose content is the tool_result block for toolu_1
    const second = requests[1]!
    const msgs = second.messages as Array<Record<string, unknown>>
    const last = msgs[msgs.length - 1]!
    expect(last.role).toBe('user')
    const blocks = last.content as Array<Record<string, unknown>>
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('tool_result')
    expect(blocks[0]!.tool_use_id).toBe('toolu_1')
  })

  it('emits an error event when the model refuses', async () => {
    const { client } = fakeClient([{ content: [], stop_reason: 'refusal' }])
    const events: Array<Record<string, unknown>> = []
    await runCopilotTurn({
      client,
      system: 'sys',
      messages: [{ role: 'user', content: 'x' }],
      executeTool: async () => ({ ok: true, data: null }),
      onEvent: (e) => events.push(e as Record<string, unknown>),
    })
    expect(events.some((e) => e.type === 'error')).toBe(true)
  })

  it('stops after the iteration cap', async () => {
    const { client, requests } = fakeClient([
      {
        content: [{ type: 'tool_use', id: 'toolu_x', name: 'read_automation', input: {} }],
        stop_reason: 'tool_use',
      },
    ])
    const events: Array<Record<string, unknown>> = []
    await runCopilotTurn({
      client,
      system: 'sys',
      messages: [{ role: 'user', content: 'loop forever' }],
      executeTool: async () => ({ ok: true, data: {} }),
      onEvent: (e) => events.push(e as Record<string, unknown>),
      maxIterations: 3,
    })
    expect(requests.length).toBe(3)
    expect(events.some((e) => e.type === 'error')).toBe(true)
  })
})

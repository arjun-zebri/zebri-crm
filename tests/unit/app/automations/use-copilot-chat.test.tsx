/**
 * Copilot chat hook — entry identity regression test.
 *
 * Several SSE events usually arrive in ONE stream chunk, so the hook
 * pushes multiple entries inside a single React batch. Entry ids must
 * be captured per push (not read lazily inside the state updater), or
 * batched pushes all read the final ref value and collide — the
 * "two children with the same key" bug seen live.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useCopilotChat } from '@/app/(dashboard)/automations/[id]/use-copilot-chat'

function sseResponse(frames: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame))
      controller.close()
    },
  })
  return new Response(stream, { status: 200 })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useCopilotChat', () => {
  it('assigns unique ids when one chunk carries multiple events', async () => {
    // One chunk → several pushes land in the same React batch
    // alongside the user entry.
    const chunk =
      'data: {"type":"message","text":"On it."}\n\n' +
      'data: {"type":"tool_call","tool":"add_action"}\n\n' +
      'data: {"type":"tool_result","tool":"add_action","ok":false,"error":"Invalid config"}\n\n' +
      'data: {"type":"done"}\n\n'
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([chunk])))

    const { result } = renderHook(() =>
      useCopilotChat({ automationId: 'a1', onWorkflowChanged: () => {} }),
    )

    await act(async () => {
      await result.current.send('add a step')
    })
    await waitFor(() => expect(result.current.busy).toBe(false))

    const ids = result.current.entries.map((e) => e.id)
    expect(result.current.entries.length).toBe(3) // user + message + error
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('treats tool activity as transient status, not chat entries', async () => {
    const chunk =
      'data: {"type":"tool_call","tool":"set_trigger"}\n\n' +
      'data: {"type":"tool_result","tool":"set_trigger","ok":true}\n\n' +
      'data: {"type":"tool_call","tool":"add_action"}\n\n' +
      'data: {"type":"tool_result","tool":"add_action","ok":true}\n\n' +
      'data: {"type":"message","text":"Done."}\n\n' +
      'data: {"type":"done"}\n\n'
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([chunk])))

    const { result } = renderHook(() =>
      useCopilotChat({ automationId: 'a1', onWorkflowChanged: () => {} }),
    )
    await act(async () => {
      await result.current.send('build it')
    })
    await waitFor(() => expect(result.current.busy).toBe(false))

    // No activity rows survive in the transcript, and the transient
    // indicator is cleared once the turn ends.
    expect(result.current.entries.map((e) => e.kind)).toEqual(['user', 'assistant'])
    expect(result.current.activity).toBeNull()
  })
})

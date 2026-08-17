/**
 * SSE event encoding tests — the wire contract between the copilot
 * route and the panel.
 */
import { describe, expect, it } from 'vitest'

import { createSseParser, encodeCopilotEvent } from '@/lib/automations/ai-copilot/stream'

describe('encodeCopilotEvent', () => {
  it('encodes an event as an SSE data line', () => {
    const wire = encodeCopilotEvent({ type: 'message', text: 'Hello' })
    expect(wire).toBe('data: {"type":"message","text":"Hello"}\n\n')
  })

  it('round-trips through JSON.parse', () => {
    const wire = encodeCopilotEvent({ type: 'tool_result', tool: 'add_action', ok: true })
    const parsed = JSON.parse(wire.slice('data: '.length))
    expect(parsed).toEqual({ type: 'tool_result', tool: 'add_action', ok: true })
  })

  it('keeps newlines in payloads on a single SSE line', () => {
    const wire = encodeCopilotEvent({ type: 'message', text: 'a\nb' })
    // JSON escapes the newline, so the frame stays one data: line
    expect(wire.split('\n')).toHaveLength(3) // data line + 2 empties
  })
})

describe('createSseParser', () => {
  it('parses complete frames and buffers partial ones across chunks', () => {
    const parser = createSseParser()
    const first = parser.push('data: {"type":"message","text":"hi"}\n\ndata: {"ty')
    expect(first).toEqual([{ type: 'message', text: 'hi' }])
    const second = parser.push('pe":"done"}\n\n')
    expect(second).toEqual([{ type: 'done' }])
  })

  it('skips malformed frames without throwing', () => {
    const parser = createSseParser()
    const events = parser.push('data: {not-json}\n\ndata: {"type":"done"}\n\n')
    expect(events).toEqual([{ type: 'done' }])
  })
})

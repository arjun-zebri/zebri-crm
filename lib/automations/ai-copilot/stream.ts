/**
 * SSE wire format for the copilot route ↔ panel stream.
 *
 * Every event is one `data: <json>\n\n` frame. JSON escaping keeps
 * multi-line payloads on a single SSE line, so the client can parse
 * each frame with `JSON.parse(line.slice(6))`.
 *
 * @module lib/automations/ai-copilot/stream
 */

/** Events the copilot route streams to the panel. */
export type CopilotStreamEvent =
  | { type: 'message'; text: string }
  | { type: 'tool_call'; tool: string; input?: unknown }
  | { type: 'tool_result'; tool: string; ok: boolean; data?: unknown; error?: string }
  | { type: 'error'; message?: string }
  | { type: 'done' }
  | Record<string, unknown>

/** Encode one event as an SSE `data:` frame. */
export function encodeCopilotEvent(event: CopilotStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

/**
 * Incremental SSE parser for the panel side of the stream. Push raw
 * chunks as they arrive; complete `data:` frames come back as parsed
 * events, partial frames buffer until the next chunk, malformed
 * frames are skipped (a glitched frame must not kill the chat).
 */
export function createSseParser(): { push(chunk: string): CopilotStreamEvent[] } {
  let buffer = ''
  return {
    push(chunk: string): CopilotStreamEvent[] {
      buffer += chunk
      const events: CopilotStreamEvent[] = []
      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        if (frame.startsWith('data: ')) {
          try {
            events.push(JSON.parse(frame.slice(6)) as CopilotStreamEvent)
          } catch {
            // skip malformed frame
          }
        }
        boundary = buffer.indexOf('\n\n')
      }
      return events
    },
  }
}

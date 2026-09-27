/**
 * The copilot is not an activation path (Task 34).
 *
 * Turn on is gated by the pre-flight in `setTemplateStatusAction`. The
 * copilot never reaches that switch: it has no tool that changes a
 * workflow's status, and its mutating tools refuse anything but a draft
 * (tool-executors.test.ts), so it cannot turn a workflow on, nor add an
 * unfinished step to one already on. This pins the first half: a status
 * tool added later must come with the pre-flight gate.
 */
import { describe, expect, it } from 'vitest'

import { buildCopilotToolDefinitions } from '@/lib/workflows/ai-copilot/llm-client'
import { executeCopilotTool, type CopilotContext } from '@/lib/workflows/ai-copilot/tool-executors'

describe('the copilot and Turn on', () => {
  it('offers the model no tool that changes a workflow status', () => {
    const names = buildCopilotToolDefinitions().map((t) => t.name as string)
    expect(names.sort()).toEqual(
      ['add_action', 'list_email_templates', 'read_automation', 'remove_action', 'set_trigger', 'update_action_config'].sort(),
    )
    for (const name of names) expect(name).not.toMatch(/status|activate|turn_on|enable/)
  })

  it('refuses a status tool the model invents, without touching the database', async () => {
    const ctx = {
      automationId: 't1',
      supabase: new Proxy({}, { get: () => { throw new Error('no database call expected') } }),
    } as unknown as CopilotContext
    const res = await executeCopilotTool('set_status' as never, { status: 'active' }, ctx)
    expect(res).toEqual({ ok: false, error: 'Unknown tool "set_status".' })
  })
})

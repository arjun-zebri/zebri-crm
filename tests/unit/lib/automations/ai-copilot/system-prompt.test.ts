/**
 * System prompt builder tests.
 *
 * The prompt is the model's contract with the engine: it must carry
 * every launch-visible trigger/action (and only those), the
 * flow-control vocabulary, and the safety rules — and it must be
 * byte-stable across calls so OpenAI's automatic prefix caching hits.
 */
import { describe, expect, it } from 'vitest'

import {
  buildAutomationStateContext,
  buildCopilotSystemPrompt,
} from '@/lib/automations/ai-copilot/system-prompt'

describe('buildCopilotSystemPrompt', () => {
  const prompt = buildCopilotSystemPrompt()

  it('includes launch-visible triggers with their labels', () => {
    expect(prompt).toContain('new_enquiry')
    expect(prompt).toContain('New enquiry')
    expect(prompt).toContain('contract_signed')
  })

  it('excludes launch-hidden triggers', () => {
    expect(prompt).not.toContain('payment_failed')
    expect(prompt).not.toContain('webhook_received')
  })

  it('includes launch-visible actions and flow control', () => {
    expect(prompt).toContain('send_email')
    expect(prompt).toContain('create_task')
    expect(prompt).toContain('wait')
    expect(prompt).toContain('branch')
  })

  it('excludes coming-soon and hidden actions', () => {
    expect(prompt).not.toContain('send_sms')
    expect(prompt).not.toContain('send_whatsapp')
    expect(prompt).not.toContain('update_custom_fields')
  })

  it('states the safety rules', () => {
    expect(prompt).toMatch(/draft/i)
    expect(prompt).toMatch(/never activate/i)
  })

  it('scopes the copilot to the one open automation', () => {
    // A "now build me another automation" request must never be
    // treated as an edit of the current one (it used to overwrite the
    // trigger and steps of the automation the user just finished).
    expect(prompt).toMatch(/only edits? (this one|the automation)/i)
    expect(prompt).toMatch(/new automation/i)
    expect(prompt).toMatch(/Automations page/)
  })

  it('carries email-writing rules for inline send_email content', () => {
    // Each email step must be written for its own moment in the
    // couple's journey — a quote follow-up must not be a re-send of
    // the enquiry acknowledgement.
    expect(prompt).toMatch(/each email .*its own/i)
    expect(prompt).toMatch(/never (reuse|copy)/i)
    expect(prompt).toMatch(/subject/i)
  })

  it('is byte-stable across calls (prefix-cache friendly)', () => {
    expect(buildCopilotSystemPrompt()).toBe(prompt)
    expect(prompt).not.toMatch(/\d{4}-\d{2}-\d{2}T/) // no timestamps
  })

  it('renders compact config signatures, not raw JSON Schema dumps', () => {
    expect(prompt).not.toContain('"type":"object"')
    expect(prompt).not.toContain('additionalProperties')
    // enum values survive compaction so the model can pick valid ones
    expect(prompt).toContain('referral')
    // Raw JSON-Schema dumps were ~39K chars; compact signatures land
    // ~18K (≈4.5K tokens). The bound guards against schema-dump
    // regressions, with headroom for catalogue growth.
    expect(prompt.length).toBeLessThan(20_000)
  })
})

describe('buildAutomationStateContext', () => {
  it('serializes the trigger and ordered steps with ids', () => {
    const context = buildAutomationStateContext(
      {
        name: 'Enquiry follow-up',
        status: 'draft',
        trigger_type: 'new_enquiry',
        trigger_config: {},
      },
      [
        {
          id: 'a1',
          position: 100,
          type: 'wait',
          label: null,
          config: { mode: 'duration', durationMinutes: 15 },
          parent_action_id: null,
          branch_path: null,
        },
      ],
    )
    expect(context).toContain('new_enquiry')
    expect(context).toContain('a1')
    expect(context).toContain('wait')
    expect(context).toContain('draft')
  })
})

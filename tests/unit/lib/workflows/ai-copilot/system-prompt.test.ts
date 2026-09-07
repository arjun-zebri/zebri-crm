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
} from '@/lib/workflows/ai-copilot/system-prompt'

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
    expect(prompt).toContain('wait')
    expect(prompt).toContain('branch')
  })

  it('teaches the manual step types, which are the point of workflows', () => {
    // A copilot that can only add actions cannot build the gate that
    // makes a workflow different from a list of automations.
    expect(prompt).toContain('todo')
    expect(prompt).toContain('appointment')
    expect(prompt).toMatch(/ticks? (these|it) off/i)
  })

  it('teaches all three timing modes, wedding-relative first', () => {
    expect(prompt).toContain('wedding_relative')
    expect(prompt).toContain('apply_relative')
    expect(prompt).toContain('after_previous')
    // The one that reschedules itself when a couple moves the date.
    expect(prompt).toMatch(/moves? the date/i)
  })

  it('offers the review gate on sends', () => {
    expect(prompt).toContain('requiresApproval')
  })

  it('does not offer the retired create_task action', () => {
    // Two things called "to-do" behaving in opposite ways is a trap:
    // the `todo` step gates what follows, create_task gated nothing.
    expect(prompt).not.toContain('create_task')
  })

  it('excludes coming-soon and hidden actions', () => {
    expect(prompt).not.toContain('send_sms')
    expect(prompt).not.toContain('send_whatsapp')
    expect(prompt).not.toContain('update_custom_fields')
  })

  it('states the safety rules', () => {
    expect(prompt).toMatch(/turned off/i)
    expect(prompt).toMatch(/never turn a workflow on/i)
  })

  it('scopes the copilot to the one open workflow', () => {
    // A "now build me another workflow" request must never be treated
    // as an edit of the current one (it used to overwrite the trigger
    // and steps of the workflow the user had just finished).
    expect(prompt).toMatch(/only edit the workflow open on this canvas/i)
    expect(prompt).toMatch(/separate workflow/i)
    // Points at the live page, not the retired Automations one.
    expect(prompt).toMatch(/Workflows page/)
    expect(prompt).not.toMatch(/Automations page/)
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

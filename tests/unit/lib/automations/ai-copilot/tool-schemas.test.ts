/**
 * AI copilot config validation tests.
 *
 * The copilot may only author configs the existing engine accepts:
 * registry actions validate against their spec's Zod schema,
 * flow-control actions against the conditions.ts schemas, triggers
 * against the trigger registry — and anything hidden from the launch
 * catalogue (or flagged coming-soon) is refused outright so the AI
 * can never draft a step the runner won't execute.
 */
import { describe, expect, it } from 'vitest'

import {
  validateActionConfig,
  validateTriggerConfig,
} from '@/lib/automations/ai-copilot/tool-schemas'

describe('validateActionConfig', () => {
  it('accepts a valid wait config (flow control)', () => {
    const res = validateActionConfig('wait', {
      mode: 'duration',
      durationMinutes: 4320,
    })
    expect(res.ok).toBe(true)
  })

  it('rejects a wait config with a bogus mode', () => {
    const res = validateActionConfig('wait', { mode: 'someday' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/mode/i)
  })

  it('accepts a valid branch config with a predicate', () => {
    const res = validateActionConfig('branch', {
      predicate: { kind: 'has_signed_contract' },
    })
    expect(res.ok).toBe(true)
  })

  it('rejects an unknown action type', () => {
    const res = validateActionConfig('launch_fireworks' as never, {})
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/unknown|not available/i)
  })

  it('rejects a coming-soon action (send_sms)', () => {
    const res = validateActionConfig('send_sms', { body: 'hi' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/coming soon|not available/i)
  })

  it('rejects a registry action hidden from the launch catalogue', () => {
    const res = validateActionConfig('update_custom_fields' as never, {})
    expect(res.ok).toBe(false)
  })

  it('surfaces Zod issues for an invalid registry action config', () => {
    // create_task requires at least a title — an empty config must fail
    // with a message naming the offending field so the model can
    // self-correct on the next turn.
    const res = validateActionConfig('create_task', {})
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.length).toBeGreaterThan(0)
  })
})

describe('validateTriggerConfig', () => {
  it('accepts a launch-visible trigger with an empty config', () => {
    const res = validateTriggerConfig('new_enquiry', {})
    expect(res.ok).toBe(true)
  })

  it('rejects a trigger hidden from the launch catalogue', () => {
    const res = validateTriggerConfig('payment_failed' as never, {})
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/not available/i)
  })

  it('rejects an unknown trigger type', () => {
    const res = validateTriggerConfig('comet_sighted' as never, {})
    expect(res.ok).toBe(false)
  })

  it('returns the parsed (defaulted) config on success', () => {
    const res = validateTriggerConfig('new_enquiry', {})
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.config).toBeTypeOf('object')
  })
})

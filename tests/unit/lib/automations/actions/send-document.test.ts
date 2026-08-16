/**
 * `send_contract` / `send_invoice` config.
 *
 * Both steps send the couple's most recent document as saved, so
 * their schemas declare only the id that overrides that pick. The
 * fields they used to carry are gone from the declaration but must
 * still *parse*: an automation saved against them is a live row, and
 * a rejected config is a step that fails at run time rather than one
 * that quietly ignores a setting it never read.
 */
import { describe, expect, it } from 'vitest'

import { actionRegistry } from '@/lib/automations/actions'

const contract = actionRegistry.send_contract!.configSchema
const invoice = actionRegistry.send_invoice!.configSchema

describe('send_contract config', () => {
  it('accepts an empty config, which is how the step is offered', () => {
    expect(contract.safeParse({}).success).toBe(true)
  })

  it('still parses a config saved against the retired fields', () => {
    const legacy = {
      templateId: 'tpl_123',
      signersRequired: 'both',
      expiryDays: 30,
      customMessage: 'Please sign by Friday.',
    }
    const parsed = contract.safeParse(legacy)
    expect(parsed.success).toBe(true)
    // Passthrough keeps them on the object; the handler simply does
    // not read them.
    expect(parsed.success && parsed.data).toMatchObject(legacy)
  })

  it('keeps the one field the handler reads', () => {
    const id = '7f2c1e58-0000-4000-8000-000000000001'
    const parsed = contract.safeParse({ contractId: id })
    expect(parsed.success && (parsed.data as { contractId?: string }).contractId).toBe(id)
  })

  it('rejects a contract id that is not an id', () => {
    expect(contract.safeParse({ contractId: 'the latest one' }).success).toBe(false)
  })
})

describe('send_invoice config', () => {
  it('accepts an empty config and a legacy one alike', () => {
    expect(invoice.safeParse({}).success).toBe(true)
    expect(
      invoice.safeParse({ paymentMethods: ['card'], dueInDays: 14, customMessage: 'thanks' })
        .success,
    ).toBe(true)
  })
})

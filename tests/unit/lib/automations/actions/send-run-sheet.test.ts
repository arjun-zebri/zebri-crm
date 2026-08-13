/**
 * The merged "Send run sheet" action (`send_timeline_to_vendors`).
 *
 * It absorbed `send_final_run_sheet` and `generate_run_sheet_pdf` via
 * three recipient flags. The property worth pinning is back-compat: a
 * config saved before the merge has no flags, and it must keep doing
 * exactly what it did — vendors only.
 */
import { describe, expect, it } from 'vitest'

import { actionRegistry } from '@/lib/automations/actions'

const spec = actionRegistry.send_timeline_to_vendors!

describe('send run sheet config', () => {
  it('defaults a pre-merge config to vendors only', () => {
    const parsed = spec.configSchema.parse({ message: 'Timeline attached.' })
    expect(parsed.sendToVendors).toBe(true)
    expect(parsed.sendToCouple).toBe(false)
    expect(parsed.sendToMe).toBe(false)
  })

  it('accepts each recipient flag', () => {
    const parsed = spec.configSchema.parse({
      message: 'Run sheet below.',
      sendToVendors: false,
      sendToCouple: true,
      sendToMe: true,
    })
    expect(parsed.sendToVendors).toBe(false)
    expect(parsed.sendToCouple).toBe(true)
    expect(parsed.sendToMe).toBe(true)
  })

  it('still parses the long-dead Phase 14a fields', () => {
    const legacy = { message: 'x', vendorFilter: ['dj'], format: 'their_cues_only', ccCouple: true }
    expect(spec.configSchema.safeParse(legacy).success).toBe(true)
  })

  it('keeps the folded-in actions in the registry for saved automations', () => {
    expect(actionRegistry.send_final_run_sheet).toBeDefined()
    expect(actionRegistry.generate_run_sheet_pdf).toBeDefined()
    expect(actionRegistry.trigger_payment_reminder).toBeDefined()
  })
})

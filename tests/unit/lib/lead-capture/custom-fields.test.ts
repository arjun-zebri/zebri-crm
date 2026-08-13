/**
 * Unit tests for the custom-fields extension of the lead-capture submit schema.
 *
 * @module tests/unit/lib/lead-capture/custom-fields
 */
import { describe, expect, it } from 'vitest'

import { leadSubmitSchema } from '@/lib/lead-capture/schema'

const base = {
  token: '00000000-0000-0000-0000-000000000000',
  name: 'Sam',
  email: 'sam@example.com',
  rendered_at: 0,
}

describe('leadSubmitSchema custom fields', () => {
  it('accepts a custom fields bag', () => {
    const r = leadSubmitSchema.safeParse({
      ...base,
      custom: [{ label: 'Guest count', value: '120' }],
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.custom?.[0]?.label).toBe('Guest count')
  })

  it('accepts a payload with no custom bag', () => {
    expect(leadSubmitSchema.safeParse(base).success).toBe(true)
  })

  it('rejects a non-array custom value', () => {
    const r = leadSubmitSchema.safeParse({ ...base, custom: 'nope' })
    expect(r.success).toBe(false)
  })

  it('rejects a custom item with an empty label', () => {
    const r = leadSubmitSchema.safeParse({
      ...base,
      custom: [{ label: '', value: 'x' }],
    })
    expect(r.success).toBe(false)
  })
})

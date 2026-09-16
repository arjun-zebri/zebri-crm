/**
 * Unit tests for the proposal-close body schemas.
 *
 * @module tests/unit/lib/proposals/accept-schemas.test
 */
import { describe, expect, it } from 'vitest'

import { acceptBodySchema, declineBodySchema } from '@/lib/proposals/accept-schemas'

const TOKEN = '11111111-1111-4111-8111-111111111111'
const OPTION_ID = '22222222-2222-4222-8222-222222222222'

describe('acceptBodySchema', () => {
  it('accepts a valid body', () => {
    const result = acceptBodySchema.safeParse({ token: TOKEN, optionId: OPTION_ID, addonIds: [OPTION_ID] })
    expect(result.success).toBe(true)
  })

  it('defaults addonIds to an empty array', () => {
    const result = acceptBodySchema.safeParse({ token: TOKEN, optionId: OPTION_ID })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.addonIds).toEqual([])
  })

  it('rejects a non-uuid token', () => {
    const result = acceptBodySchema.safeParse({ token: 'not-a-uuid', optionId: OPTION_ID, addonIds: [] })
    expect(result.success).toBe(false)
  })

  it('rejects more than 20 add-ons', () => {
    const addonIds = Array.from({ length: 21 }, () => OPTION_ID)
    const result = acceptBodySchema.safeParse({ token: TOKEN, optionId: OPTION_ID, addonIds })
    expect(result.success).toBe(false)
  })
})

describe('declineBodySchema', () => {
  it('accepts a valid body', () => {
    const result = declineBodySchema.safeParse({ token: TOKEN, reason: 'price' })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown reason', () => {
    const result = declineBodySchema.safeParse({ token: TOKEN, reason: 'weather' })
    expect(result.success).toBe(false)
  })

  it('rejects a message over 1000 characters', () => {
    const result = declineBodySchema.safeParse({ token: TOKEN, reason: 'price', message: 'x'.repeat(1001) })
    expect(result.success).toBe(false)
  })
})

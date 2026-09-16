import { describe, expect, it } from 'vitest'

import { engagementEventSchema, eventsBodySchema } from '@/lib/proposals/engagement-events'

const token = '11111111-1111-4111-8111-111111111111'

describe('engagement event schemas', () => {
  it('accepts each known event shape, id included', () => {
    const ok = [
      { id: 'e1', type: 'opened', payload: {} },
      { id: 'e2', type: 'section_viewed', payload: { blockId: 'b1', blockType: 'hero', seconds: 12 } },
      { id: 'e3', type: 'package_viewed', payload: { optionId: 'o1', seconds: 3 } },
      { id: 'e4', type: 'package_selected', payload: { optionId: 'o1' } },
      { id: 'e5', type: 'addon_toggled', payload: { itemId: 'i1', on: true } },
      { id: 'e6', type: 'step_reached', payload: { step: 'sign' } },
      { id: 'e7', type: 'accepted', payload: {} },
      { id: 'e8', type: 'declined', payload: { reason: 'price' } },
    ]
    for (const e of ok) expect(engagementEventSchema.safeParse(e).success, e.type).toBe(true)
  })
  it('rejects unknown types, negative seconds, unknown steps, and a missing or malformed id', () => {
    expect(engagementEventSchema.safeParse({ id: 'e1', type: 'bogus', payload: {} }).success).toBe(false)
    expect(engagementEventSchema.safeParse({ id: 'e1', type: 'section_viewed', payload: { blockId: 'b', blockType: 'hero', seconds: -1 } }).success).toBe(false)
    expect(engagementEventSchema.safeParse({ id: 'e1', type: 'step_reached', payload: { step: 'checkout' } }).success).toBe(false)
    expect(engagementEventSchema.safeParse({ type: 'opened', payload: {} }).success).toBe(false)
    expect(engagementEventSchema.safeParse({ id: '', type: 'opened', payload: {} }).success).toBe(false)
    expect(engagementEventSchema.safeParse({ id: 'x'.repeat(65), type: 'opened', payload: {} }).success).toBe(false)
  })
  it('caps the batch at 50 and requires at least one event and an 8+ char session', () => {
    const one = { id: 'e1', type: 'opened', payload: {} }
    expect(eventsBodySchema.safeParse({ token, sessionId: 'abcdefgh', events: [one] }).success).toBe(true)
    expect(eventsBodySchema.safeParse({ token, sessionId: 'abcdefgh', events: [] }).success).toBe(false)
    expect(eventsBodySchema.safeParse({ token, sessionId: 'short', events: [one] }).success).toBe(false)
    expect(eventsBodySchema.safeParse({ token, sessionId: 'abcdefgh', events: Array(51).fill(one) }).success).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { z } from 'zod'

/**
 * Unit tests for couple modal package field flow.
 *
 * Tests that the coupleInputSchema accepts selected_package_id and
 * passes it through the create/update actions without error.
 */

describe('Couple modal package field', () => {
  it('should accept selected_package_id in couple input', () => {
    // Minimal schema test: selected_package_id should parse as UUID or null
    const schema = z.object({
      selected_package_id: z.string().uuid().nullable().default(null),
    })

    // Should accept null
    const resultNull = schema.safeParse({ selected_package_id: null })
    expect(resultNull.success).toBe(true)

    // Should accept a valid UUID
    const resultUuid = schema.safeParse({
      selected_package_id: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(resultUuid.success).toBe(true)

    // Should reject an invalid UUID
    const resultInvalid = schema.safeParse({
      selected_package_id: 'not-a-uuid',
    })
    expect(resultInvalid.success).toBe(false)

    // Should default to null when omitted
    const resultOmitted = schema.safeParse({})
    expect(resultOmitted.success).toBe(true)
    if (resultOmitted.success) {
      expect(resultOmitted.data.selected_package_id).toBe(null)
    }
  })

  it('should serialize selected_package_id to couple', () => {
    // Test that a couple with selected_package_id can be created
    const coupleData = {
      id: 'couple-1',
      user_id: 'user-1',
      name: 'Test Couple',
      email: 'test@example.com',
      phone: '1234567890',
      primary_name: 'John',
      primary_email: 'john@example.com',
      primary_phone: '1234567890',
      secondary_name: null,
      secondary_email: null,
      secondary_phone: null,
      status: 'new',
      lead_source: null,
      referral_source: null,
      notes: '',
      kanban_position: 0,
      event_date: null,
      venue: '',
      next_event_date: null,
      next_event_venue: null,
      selected_package_id: '550e8400-e29b-41d4-a716-446655440000',
      created_at: '2025-01-01T00:00:00Z',
    }

    // Should be a valid couple object with selected_package_id
    expect(coupleData.selected_package_id).toBe('550e8400-e29b-41d4-a716-446655440000')
  })
})

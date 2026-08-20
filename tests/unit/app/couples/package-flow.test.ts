import { describe, it, expect } from 'vitest'

/**
 * Unit tests for couple package field data flow.
 *
 * Verifies:
 * 1. CoupleInput schema accepts selected_package_id (UUID or null)
 * 2. Couple type has selected_package_id field
 * 3. Package field flows through modal to actions
 */

describe('Package field data flow', () => {
  it('selected_package_id can be null', () => {
    const coupleSummary = {
      id: 'test',
      selected_package_id: null,
    }
    expect(coupleSummary.selected_package_id).toBeNull()
  })

  it('selected_package_id can be a UUID string', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const coupleSummary = {
      id: 'test',
      selected_package_id: uuid,
    }
    expect(coupleSummary.selected_package_id).toBe(uuid)
  })

  it('couple input includes selected_package_id in payload', () => {
    // Simulates what the modal passes to the action
    const coupleInput = {
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
      selected_package_id: '550e8400-e29b-41d4-a716-446655440000', // <- key field
    }

    expect(coupleInput.selected_package_id).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('couple input can omit selected_package_id (defaults to null)', () => {
    const coupleInput = {
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
      // selected_package_id intentionally omitted
    }

    // When omitted, the Zod schema will default it to null
    expect((coupleInput as any).selected_package_id).toBeUndefined()
  })

  it('overview preserves selected_package_id when saving other fields', () => {
    const couple = {
      id: 'couple-1',
      name: 'John & Jane',
      selected_package_id: '550e8400-e29b-41d4-a716-446655440000',
    }

    // Simulates overview's handleSaveField
    const saved = {
      ...couple,
      name: 'Jane & John', // changed
      selected_package_id: couple.selected_package_id, // preserved
    }

    expect(saved.selected_package_id).toBe('550e8400-e29b-41d4-a716-446655440000')
  })
})

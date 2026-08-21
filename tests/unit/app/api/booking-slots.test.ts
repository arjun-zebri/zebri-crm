/**
 * Tests for the public slots API query schema.
 *
 * @module tests/unit/app/api/booking-slots
 */

import { describe, it, expect } from 'vitest';

import { slotsQuerySchema } from '@/app/api/booking/slots-schema';

describe('Slots query schema', () => {
  it('passes a valid query with token, from, and to', () => {
    const result = slotsQuerySchema.safeParse({
      token: '550e8400-e29b-41d4-a716-446655440000',
      from: '2025-01-01',
      to: '2025-01-31',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.token).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.data.from).toBe('2025-01-01');
      expect(result.data.to).toBe('2025-01-31');
    }
  });

  it('rejects a malformed UUID token', () => {
    const result = slotsQuerySchema.safeParse({
      token: 'not-a-uuid',
      from: '2025-01-01',
      to: '2025-01-31',
    });
    expect(result.success).toBe(false);
  });

  it('rejects when to is before from', () => {
    const result = slotsQuerySchema.safeParse({
      token: '550e8400-e29b-41d4-a716-446655440000',
      from: '2025-01-31',
      to: '2025-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a range exceeding 31 days', () => {
    const result = slotsQuerySchema.safeParse({
      token: '550e8400-e29b-41d4-a716-446655440000',
      from: '2025-01-01',
      to: '2025-02-02',
    });
    expect(result.success).toBe(false);
  });

  it('passes a range of exactly 31 days', () => {
    // Boundary test: 31 calendar days INCLUSIVE is the max. Jan 1 to Feb 1 is
    // exactly 31 days; the route will extend to Feb 2 at 00:00 (32 clock days
    // exclusive-end) so the slot engine captures the full Feb 1.
    const result = slotsQuerySchema.safeParse({
      token: '550e8400-e29b-41d4-a716-446655440000',
      from: '2025-01-01',
      to: '2025-02-01',
    });
    expect(result.success).toBe(true);
  });

  it('accepts manageToken instead of token', () => {
    const result = slotsQuerySchema.safeParse({
      manageToken: '550e8400-e29b-41d4-a716-446655440000',
      from: '2025-01-01',
      to: '2025-01-31',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.manageToken).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.data.from).toBe('2025-01-01');
      expect(result.data.to).toBe('2025-01-31');
    }
  });

  it('rejects when both token and manageToken are provided', () => {
    const result = slotsQuerySchema.safeParse({
      token: '550e8400-e29b-41d4-a716-446655440000',
      manageToken: '660e8400-e29b-41d4-a716-446655440000',
      from: '2025-01-01',
      to: '2025-01-31',
    });
    expect(result.success).toBe(false);
  });

  it('rejects when neither token nor manageToken is provided', () => {
    const result = slotsQuerySchema.safeParse({
      from: '2025-01-01',
      to: '2025-01-31',
    });
    expect(result.success).toBe(false);
  });
});

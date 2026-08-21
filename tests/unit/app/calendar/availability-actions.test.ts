/**
 * Unit tests for the availability server actions in
 * `app/(dashboard)/calendar/availability-schemas.ts`.
 *
 * Covers Zod validation of availability rules and overrides schemas.
 */
import { describe, expect, it } from 'vitest';

async function loadActions() {
  return await import('@/app/(dashboard)/calendar/availability-schemas');
}

describe('availabilityRuleSchema', () => {
  it('accepts a valid rule with weekday 0-6 and HH:mm times', async () => {
    const { availabilityRuleSchema } = await loadActions();
    const input = { weekday: 2, start_time: '09:00', end_time: '17:00' };
    const result = availabilityRuleSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects weekday 7 (out of range)', async () => {
    const { availabilityRuleSchema } = await loadActions();
    const input = { weekday: 7, start_time: '09:00', end_time: '17:00' };
    const result = availabilityRuleSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects weekday -1 (out of range)', async () => {
    const { availabilityRuleSchema } = await loadActions();
    const input = { weekday: -1, start_time: '09:00', end_time: '17:00' };
    const result = availabilityRuleSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects invalid time format "25:00"', async () => {
    const { availabilityRuleSchema } = await loadActions();
    const input = { weekday: 2, start_time: '25:00', end_time: '17:00' };
    const result = availabilityRuleSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects invalid time format "09:60"', async () => {
    const { availabilityRuleSchema } = await loadActions();
    const input = { weekday: 2, start_time: '09:00', end_time: '09:60' };
    const result = availabilityRuleSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects start_time >= end_time', async () => {
    const { availabilityRuleSchema } = await loadActions();
    const input = { weekday: 2, start_time: '17:00', end_time: '09:00' };
    const result = availabilityRuleSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects start_time = end_time', async () => {
    const { availabilityRuleSchema } = await loadActions();
    const input = { weekday: 2, start_time: '09:00', end_time: '09:00' };
    const result = availabilityRuleSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('accepts all weekdays 0-6', async () => {
    const { availabilityRuleSchema } = await loadActions();
    for (let day = 0; day <= 6; day++) {
      const input = { weekday: day, start_time: '09:00', end_time: '17:00' };
      const result = availabilityRuleSchema.safeParse(input);
      expect(result.success).toBe(true);
    }
  });
});

describe('overrideSchema', () => {
  it('accepts a block (available=false, times null)', async () => {
    const { overrideSchema } = await loadActions();
    const input = { date: '2026-08-25', available: false, start_time: null, end_time: null };
    const result = overrideSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts a custom window (available=true, times set)', async () => {
    const { overrideSchema } = await loadActions();
    const input = { date: '2026-08-25', available: true, start_time: '10:00', end_time: '14:00' };
    const result = overrideSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects custom window with missing start_time', async () => {
    const { overrideSchema } = await loadActions();
    const input = { date: '2026-08-25', available: true, start_time: null, end_time: '14:00' };
    const result = overrideSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects custom window with missing end_time', async () => {
    const { overrideSchema } = await loadActions();
    const input = { date: '2026-08-25', available: true, start_time: '10:00', end_time: null };
    const result = overrideSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects block with times set', async () => {
    const { overrideSchema } = await loadActions();
    const input = { date: '2026-08-25', available: false, start_time: '10:00', end_time: '14:00' };
    const result = overrideSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects invalid date format', async () => {
    const { overrideSchema } = await loadActions();
    const input = { date: '2026/08/25', available: false, start_time: null, end_time: null };
    const result = overrideSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('timezoneSchema', () => {
  it('accepts valid IANA timezone', async () => {
    const { timezoneSchema } = await loadActions();
    const result = timezoneSchema.safeParse('America/New_York');
    expect(result.success).toBe(true);
  });

  it('accepts another valid IANA timezone', async () => {
    const { timezoneSchema } = await loadActions();
    const result = timezoneSchema.safeParse('Europe/London');
    expect(result.success).toBe(true);
  });

  it('rejects invalid timezone', async () => {
    const { timezoneSchema } = await loadActions();
    const result = timezoneSchema.safeParse('Invalid/Timezone');
    expect(result.success).toBe(false);
  });

  it('rejects UTC shorthand (must be Etc/UTC)', async () => {
    const { timezoneSchema } = await loadActions();
    const result = timezoneSchema.safeParse('UTC');
    expect(result.success).toBe(false);
  });
});

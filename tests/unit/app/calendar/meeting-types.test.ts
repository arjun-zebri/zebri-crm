/**
 * Unit tests for the meeting types server actions in
 * `app/(dashboard)/calendar/meeting-type-schema.ts`.
 *
 * Covers Zod validation of the meetingTypeInputSchema.
 */
import { describe, expect, it } from 'vitest';

async function loadActions() {
  return await import('@/app/(dashboard)/calendar/meeting-type-schema');
}

describe('meetingTypeInputSchema', () => {
  it('accepts a valid meeting type input', async () => {
    const { meetingTypeInputSchema } = await loadActions();
    const input = {
      name: 'Initial Consultation',
      description: 'First meeting to discuss details',
      duration_minutes: 30,
      location_type: 'video',
      address: null,
      buffer_before_minutes: 0,
      buffer_after_minutes: 0,
      min_notice_hours: 24,
      max_advance_days: 90,
      reminder_enabled: true,
      active: true,
    };
    const result = meetingTypeInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects duration_minutes of 3 (min is 5)', async () => {
    const { meetingTypeInputSchema } = await loadActions();
    const input = {
      name: 'Quick Sync',
      duration_minutes: 3,
      location_type: 'phone',
      buffer_before_minutes: 0,
      buffer_after_minutes: 0,
      min_notice_hours: 0,
      max_advance_days: 30,
      reminder_enabled: false,
      active: true,
    };
    const result = meetingTypeInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects unknown location_type', async () => {
    const { meetingTypeInputSchema } = await loadActions();
    const input = {
      name: 'Meeting',
      duration_minutes: 30,
      location_type: 'hybrid',
      buffer_before_minutes: 0,
      buffer_after_minutes: 0,
      min_notice_hours: 0,
      max_advance_days: 30,
      reminder_enabled: false,
      active: true,
    };
    const result = meetingTypeInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects empty name', async () => {
    const { meetingTypeInputSchema } = await loadActions();
    const input = {
      name: '',
      duration_minutes: 30,
      location_type: 'video',
      buffer_before_minutes: 0,
      buffer_after_minutes: 0,
      min_notice_hours: 0,
      max_advance_days: 30,
      reminder_enabled: false,
      active: true,
    };
    const result = meetingTypeInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects max_advance_days of 0 (min is 1)', async () => {
    const { meetingTypeInputSchema } = await loadActions();
    const input = {
      name: 'Meeting',
      duration_minutes: 30,
      location_type: 'in_person',
      address: '123 Main St',
      buffer_before_minutes: 0,
      buffer_after_minutes: 0,
      min_notice_hours: 0,
      max_advance_days: 0,
      reminder_enabled: false,
      active: true,
    };
    const result = meetingTypeInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('accepts optional address and description', async () => {
    const { meetingTypeInputSchema } = await loadActions();
    const input = {
      name: 'In-Person Consultation',
      description: 'Optional description',
      duration_minutes: 60,
      location_type: 'in_person',
      address: '123 Main St',
      buffer_before_minutes: 15,
      buffer_after_minutes: 15,
      min_notice_hours: 48,
      max_advance_days: 180,
      reminder_enabled: true,
      active: true,
    };
    const result = meetingTypeInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts all three location types', async () => {
    const { meetingTypeInputSchema } = await loadActions();
    const types = ['video', 'phone', 'in_person'];
    for (const type of types) {
      const input = {
        name: 'Meeting',
        duration_minutes: 30,
        location_type: type,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
        min_notice_hours: 0,
        max_advance_days: 30,
        reminder_enabled: false,
        active: true,
      };
      const result = meetingTypeInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    }
  });
});

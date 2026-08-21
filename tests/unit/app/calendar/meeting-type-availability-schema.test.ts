/**
 * Unit tests for per-meeting-type availability: the Zod schema, the form
 * payload, and the rule that an absent `availability` leaves the stored
 * hours alone.
 *
 * @module tests/unit/app/calendar/meeting-type-availability-schema
 */
import { describe, expect, it } from 'vitest';

import { weekFromRules } from '@/app/(dashboard)/calendar/availability-utils';
import {
  DEFAULT_FORM_STATE,
  buildMeetingTypePayload,
  type FormState,
} from '@/app/(dashboard)/calendar/meeting-type-form';
import {
  meetingTypeAvailabilitySchema,
  meetingTypeInputSchema,
  meetingTypeRowToInput,
} from '@/app/(dashboard)/calendar/meeting-type-schema';
import type { Database } from '@/types/database';

/** A valid meeting type input, before any availability is attached. */
const BASE_INPUT = {
  name: 'Discovery call',
  duration_minutes: 30,
  location_type: 'video' as const,
  max_advance_days: 60,
};

describe('meetingTypeAvailabilitySchema', () => {
  it('accepts standard hours with no rules', () => {
    const result = meetingTypeAvailabilitySchema.safeParse({ custom: false });
    expect(result.success).toBe(true);
  });

  it('accepts custom hours with windows', () => {
    const result = meetingTypeAvailabilitySchema.safeParse({
      custom: true,
      rules: [{ weekday: 6, start_time: '08:00', end_time: '11:00' }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts custom hours with no windows, meaning never bookable', () => {
    const result = meetingTypeAvailabilitySchema.safeParse({ custom: true, rules: [] });
    expect(result.success).toBe(true);
  });

  it('rejects a backwards window', () => {
    const result = meetingTypeAvailabilitySchema.safeParse({
      custom: true,
      rules: [{ weekday: 6, start_time: '11:00', end_time: '08:00' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed time and an out-of-range weekday', () => {
    expect(
      meetingTypeAvailabilitySchema.safeParse({
        custom: true,
        rules: [{ weekday: 6, start_time: '25:00', end_time: '26:00' }],
      }).success,
    ).toBe(false);

    expect(
      meetingTypeAvailabilitySchema.safeParse({
        custom: true,
        rules: [{ weekday: 7, start_time: '08:00', end_time: '11:00' }],
      }).success,
    ).toBe(false);
  });
});

describe('meetingTypeInputSchema', () => {
  it('treats availability as optional, so callers that omit it stay valid', () => {
    const result = meetingTypeInputSchema.safeParse(BASE_INPUT);
    expect(result.success).toBe(true);
    expect(result.success && result.data.availability).toBeUndefined();
  });

  it('carries availability through when it is supplied', () => {
    const result = meetingTypeInputSchema.safeParse({
      ...BASE_INPUT,
      availability: {
        custom: true,
        rules: [{ weekday: 6, start_time: '08:00', end_time: '11:00' }],
      },
    });
    expect(result.success && result.data.availability?.custom).toBe(true);
    expect(result.success && result.data.availability?.rules).toHaveLength(1);
  });
});

describe('meetingTypeRowToInput', () => {
  it('omits availability, so pausing from a card cannot wipe stored hours', () => {
    const row = {
      id: 'mt-1',
      user_id: 'user-1',
      name: 'Discovery call',
      description: null,
      duration_minutes: 30,
      location_type: 'video',
      address: null,
      buffer_before_minutes: 0,
      buffer_after_minutes: 0,
      min_notice_hours: 24,
      max_advance_days: 60,
      reminder_enabled: true,
      active: true,
      uses_custom_availability: true,
      share_token: 'token-1',
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
    } as Database['public']['Tables']['meeting_types']['Row'];

    const input = meetingTypeRowToInput(row);

    expect(input).not.toHaveProperty('availability');
  });
});

describe('buildMeetingTypePayload', () => {
  /** Form state with the given availability choice applied. */
  function formWith(overrides: Partial<FormState>): FormState {
    return { ...DEFAULT_FORM_STATE, name: 'Discovery call', ...overrides };
  }

  it('sends custom: false and no rules when the type follows standard hours', () => {
    const payload = buildMeetingTypePayload(
      formWith({
        customAvailability: false,
        // Seeded hours are still in state; they must not be sent.
        availabilityWeek: weekFromRules([
          { weekday: 1, start_time: '09:00', end_time: '17:00' },
        ]),
      }),
    );

    expect(payload.availability).toEqual({ custom: false, rules: [] });
  });

  it('sends the edited week when the type is on custom hours', () => {
    const payload = buildMeetingTypePayload(
      formWith({
        customAvailability: true,
        availabilityWeek: weekFromRules([
          { weekday: 6, start_time: '08:00', end_time: '11:00' },
          { weekday: 6, start_time: '15:00', end_time: '18:30' },
        ]),
      }),
    );

    expect(payload.availability).toEqual({
      custom: true,
      rules: [
        { weekday: 6, start_time: '08:00', end_time: '11:00' },
        { weekday: 6, start_time: '15:00', end_time: '18:30' },
      ],
    });
  });

  it('produces a payload the input schema accepts', () => {
    const payload = buildMeetingTypePayload(
      formWith({
        customAvailability: true,
        availabilityWeek: weekFromRules([
          { weekday: 2, start_time: '18:00', end_time: '20:00' },
        ]),
      }),
    );

    expect(meetingTypeInputSchema.safeParse(payload).success).toBe(true);
  });
});

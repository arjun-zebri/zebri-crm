/**
 * Booking-form fields on the meeting type schema.
 *
 * The card's pause action rebuilds the update payload from the stored row, so
 * the questions and phone mode must survive that round trip. Losing them would
 * silently strip a wedding MC's form every time a link was paused.
 *
 * @module tests/unit/app/calendar/meeting-type-row-questions
 */
import { describe, expect, it } from 'vitest';

import {
  meetingTypeInputSchema,
  meetingTypeRowToInput,
  parsePhoneField,
} from '@/app/(dashboard)/calendar/meeting-type-schema';
import type { BookingQuestion } from '@/lib/booking/questions';
import type { Database } from '@/types/database';

type MeetingTypeRow = Database['public']['Tables']['meeting_types']['Row'];

const storedQuestions: BookingQuestion[] = [
  { id: 'venue', label: 'Venue', type: 'short_text', required: false, maps_to: 'venue' },
  { id: 'pick', label: 'Pick', type: 'single_choice', required: true, options: ['A', 'B'] },
];

const baseRow: MeetingTypeRow = {
  id: '00000000-0000-4000-8000-000000000001',
  user_id: 'user-1',
  name: 'Intro call',
  description: null,
  duration_minutes: 30,
  location_type: 'video',
  address: null,
  buffer_before_minutes: 0,
  buffer_after_minutes: 0,
  min_notice_hours: 24,
  max_advance_days: 60,
  reminder_enabled: true,
  uses_custom_availability: false,
  active: true,
  share_token: 'token',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  phone_field: 'required',
  questions: storedQuestions,
};

describe('meetingTypeRowToInput', () => {
  it('carries stored questions through unchanged', () => {
    const input = meetingTypeRowToInput(baseRow);
    expect(input.questions).toEqual(baseRow.questions);
  });

  it('carries the phone mode through', () => {
    expect(meetingTypeRowToInput(baseRow).phone_field).toBe('required');
  });

  it('drops malformed stored questions instead of failing the whole row', () => {
    const row = {
      ...baseRow,
      questions: [{ id: 'bad', label: '', type: 'nope' }, storedQuestions[0]],
    } as unknown as MeetingTypeRow;
    const input = meetingTypeRowToInput(row);
    expect(input.questions).toEqual([storedQuestions[0]]);
  });

  it('falls back to the optional phone mode for an unknown stored value', () => {
    const input = meetingTypeRowToInput({ ...baseRow, phone_field: 'sometimes' });
    expect(input.phone_field).toBe('optional');
  });

  it('keeps questions when the row is re-validated for an update', () => {
    const parsed = meetingTypeInputSchema.safeParse({
      ...meetingTypeRowToInput(baseRow),
      active: false,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.questions).toHaveLength(2);
      expect(parsed.data.phone_field).toBe('required');
    }
  });
});

describe('meetingTypeInputSchema defaults', () => {
  const minimal = {
    name: 'Call',
    duration_minutes: 30,
    location_type: 'video' as const,
    max_advance_days: 60,
  };

  it('defaults questions to none and phone to optional', () => {
    const parsed = meetingTypeInputSchema.parse(minimal);
    expect(parsed.questions).toEqual([]);
    expect(parsed.phone_field).toBe('optional');
  });

  it('rejects a question list with more than the maximum', () => {
    const questions = Array.from({ length: 21 }, (_, i) => ({
      id: `q${i}`,
      label: `Q${i}`,
      type: 'short_text' as const,
      required: false,
    }));
    expect(meetingTypeInputSchema.safeParse({ ...minimal, questions }).success).toBe(false);
  });
});

describe('parsePhoneField', () => {
  it('accepts the three modes and rejects anything else', () => {
    expect(parsePhoneField('hidden')).toBe('hidden');
    expect(parsePhoneField('required')).toBe('required');
    expect(parsePhoneField(undefined)).toBe('optional');
    expect(parsePhoneField(42)).toBe('optional');
  });
});

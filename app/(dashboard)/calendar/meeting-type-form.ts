/**
 * Meeting type form state and payload helpers.
 *
 * @module app/(dashboard)/calendar/meeting-type-form
 */

import { emptyWeek, rulesFromWeek, type WeekState } from './availability-utils';

export interface FormState {
  name: string;
  description: string;
  durationMinutes: string;
  locationType: string;
  address: string;
  bufferBeforeMinutes: string;
  bufferAfterMinutes: string;
  minNoticeHours: string;
  maxAdvanceDays: string;
  reminderEnabled: boolean;
  active: boolean;
  /** True when this type runs on its own weekly hours. */
  customAvailability: boolean;
  /**
   * The type's own weekly hours. Seeded from the MC's standard hours when
   * the modal opens, so switching to custom starts from something real.
   */
  availabilityWeek: WeekState;
}

export type FormAction = { type: 'set'; payload: Partial<FormState> } | { type: 'reset' };

export const DEFAULT_FORM_STATE: FormState = {
  name: '',
  description: '',
  durationMinutes: '30',
  locationType: 'video',
  address: '',
  bufferBeforeMinutes: '0',
  bufferAfterMinutes: '0',
  minNoticeHours: '24',
  maxAdvanceDays: '60',
  reminderEnabled: true,
  active: true,
  customAvailability: false,
  availabilityWeek: emptyWeek(),
};

/**
 * Form state reducer for create/edit meeting type.
 */
export function formReducer(state: FormState, action: FormAction): FormState {
  if (action.type === 'set') {
    return { ...state, ...action.payload };
  }
  return DEFAULT_FORM_STATE;
}

/**
 * Build a mutation payload from form state. Handles type conversions
 * and conditional fields (address only when in_person).
 */
export function buildMeetingTypePayload(form: FormState) {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    duration_minutes: parseInt(form.durationMinutes, 10),
    location_type: form.locationType as 'video' | 'phone' | 'in_person',
    address: form.locationType === 'in_person' ? (form.address.trim() || null) : null,
    buffer_before_minutes: parseInt(form.bufferBeforeMinutes, 10),
    buffer_after_minutes: parseInt(form.bufferAfterMinutes, 10),
    min_notice_hours: parseInt(form.minNoticeHours, 10),
    max_advance_days: parseInt(form.maxAdvanceDays, 10),
    reminder_enabled: form.reminderEnabled,
    active: form.active,
    // Always sent from the modal, which knows the MC's intent for both
    // fields. Other callers (the card's pause action) omit it, and an
    // absent `availability` leaves the stored hours untouched.
    availability: {
      custom: form.customAvailability,
      rules: form.customAvailability ? rulesFromWeek(form.availabilityWeek) : [],
    },
  };
}

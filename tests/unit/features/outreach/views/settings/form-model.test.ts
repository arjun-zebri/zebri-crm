/**
 * Settings form validation: every bad field is reported under its own
 * key, and the dirty check compares the text the inputs show.
 */
import { describe, expect, it } from 'vitest';

import { isFormDirty, toForm, toInput, type SettingsForm } from '@/features/outreach/views/settings/form-model';
import type { OutreachSettings } from '@/lib/outreach/types';

const saved = {
  sender_name: 'Jo',
  signature: 'Jo, Zebri',
  email_ramp: [5, 10, 20],
  email_daily_cap: 30,
  ig_daily_cap: 20,
  send_window_start: '09:00:00',
  send_window_end: '17:00:00',
  send_weekdays: [5, 1],
  apify_monthly_budget_cents: 2500,
  booking_meeting_type_id: null,
} as unknown as OutreachSettings;

const form: SettingsForm = toForm(saved);

describe('toForm', () => {
  it('seeds text fields and trims the seconds off the send window', () => {
    expect(form.ramp).toBe('5, 10, 20');
    expect(form.budget_dollars).toBe('25.00');
    expect(form.send_window_start).toBe('09:00');
    expect(form.booking_meeting_type_id).toBe('__none__');
  });
});

describe('toInput errors', () => {
  it('attaches each bad field its own message', () => {
    const result = toInput({ ...form, ramp: '5, ten', email_daily_cap: '1.5', budget_dollars: '' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(['budget_dollars', 'email_daily_cap', 'ramp']);
    expect(result.errors.ramp).toMatch(/whole numbers/);
  });

  it('does not flag fields that are fine', () => {
    const result = toInput({ ...form, ig_daily_cap: 'x' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.ig_daily_cap).toBeDefined();
    expect(result.errors.ramp).toBeUndefined();
  });

  it('converts a valid form to the save shape', () => {
    const result = toInput(form);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.apify_monthly_budget_cents).toBe(2500);
    expect(result.data.send_weekdays).toEqual([1, 5]);
    expect(result.data.booking_meeting_type_id).toBeNull();
  });
});

describe('isFormDirty', () => {
  it('is clean for an untouched form', () => {
    expect(isFormDirty(form, toForm(saved))).toBe(false);
  });

  it('is dirty once any field differs', () => {
    expect(isFormDirty({ ...form, sender_name: 'Jo B' }, form)).toBe(true);
  });
});

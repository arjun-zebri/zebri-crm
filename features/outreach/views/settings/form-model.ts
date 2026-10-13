/**
 * Settings form state: how the editable strings map to the save input.
 *
 * The form holds text (what the inputs show) and converts to the server
 * shape only on save, so typing never fights a number field. Validation
 * returns a message per field so each message sits under its input.
 * Pure, so the conversions are easy to reason about and test.
 *
 * @module features/outreach/views/settings/form-model
 */
import type { SettingsInput } from '@/lib/outreach/services/settings';
import type { OutreachSettings } from '@/lib/outreach/types';

/** Sentinel for "no booking page". A Select option must never be "". */
export const NO_BOOKING = '__none__';

/** Editable settings as the inputs hold them. */
export interface SettingsForm {
  sender_name: string;
  signature: string;
  /** Comma-separated daily email caps, one per week of the ramp. */
  ramp: string;
  email_daily_cap: string;
  ig_daily_cap: string;
  send_window_start: string;
  send_window_end: string;
  send_weekdays: number[];
  /** Dollars as typed, e.g. "25.00". */
  budget_dollars: string;
  /** A meeting type id, or {@link NO_BOOKING}. */
  booking_meeting_type_id: string;
}

/** One message per field that failed validation. Keys match {@link SettingsForm}. */
export type FieldErrors = Partial<Record<keyof SettingsForm, string>>;

/**
 * Seed the form from saved settings.
 *
 * @param s - The saved settings row.
 * @returns Form state with every value as text.
 */
export function toForm(s: OutreachSettings): SettingsForm {
  return {
    sender_name: s.sender_name,
    signature: s.signature,
    ramp: s.email_ramp.join(', '),
    email_daily_cap: String(s.email_daily_cap),
    ig_daily_cap: String(s.ig_daily_cap),
    // Postgres time comes back as HH:mm:ss; the picker works in HH:mm.
    send_window_start: s.send_window_start.slice(0, 5),
    send_window_end: s.send_window_end.slice(0, 5),
    send_weekdays: [...s.send_weekdays],
    budget_dollars: (s.apify_monthly_budget_cents / 100).toFixed(2),
    booking_meeting_type_id: s.booking_meeting_type_id ?? NO_BOOKING,
  };
}

/** Whole non-negative number, or null. Rejects "1.5", "-2" and blanks. */
function wholeNumber(text: string): number | null {
  const t = text.trim();
  return /^\d+$/.test(t) ? Number(t) : null;
}

/**
 * Convert form state to the save input, or say which fields are wrong.
 *
 * Every field is checked, not just the first, so the founder sees all
 * the problems in one pass.
 *
 * @param f - Current form state.
 * @returns The save input, or the message for each invalid field.
 */
export function toInput(f: SettingsForm): { ok: true; data: SettingsInput } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};

  const parts = f.ramp.split(',').map((p) => p.trim()).filter((p) => p !== '');
  const ramp = parts.map(wholeNumber);
  if (parts.length === 0) errors.ramp = 'Add at least one weekly email cap.';
  else if (ramp.some((n) => n === null)) errors.ramp = 'Use whole numbers separated by commas, like 5, 10, 20.';

  const emailCap = wholeNumber(f.email_daily_cap);
  const igCap = wholeNumber(f.ig_daily_cap);
  if (emailCap === null) errors.email_daily_cap = 'Enter a whole number, like 30.';
  if (igCap === null) errors.ig_daily_cap = 'Enter a whole number, like 20.';

  const dollars = Number(f.budget_dollars.trim());
  if (f.budget_dollars.trim() === '' || !Number.isFinite(dollars) || dollars < 0) {
    errors.budget_dollars = 'Enter a dollar amount, like 25.00.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      sender_name: f.sender_name.trim(),
      signature: f.signature.trim(),
      email_ramp: ramp as number[],
      email_daily_cap: emailCap as number,
      ig_daily_cap: igCap as number,
      send_window_start: f.send_window_start,
      send_window_end: f.send_window_end,
      send_weekdays: [...f.send_weekdays].sort((a, b) => a - b),
      apify_monthly_budget_cents: Math.round(dollars * 100),
      booking_meeting_type_id: f.booking_meeting_type_id === NO_BOOKING ? null : f.booking_meeting_type_id,
    },
  };
}

/**
 * True when the form differs from the last saved state. Compares the
 * text form, so typing and retyping the same value is not "changed".
 *
 * @param form - Current form state.
 * @param saved - The form as last saved (or as loaded).
 */
export function isFormDirty(form: SettingsForm, saved: SettingsForm): boolean {
  return JSON.stringify(form) !== JSON.stringify(saved);
}

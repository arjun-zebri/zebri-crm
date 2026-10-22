/**
 * Pure list operations behind the meeting type booking-form editor.
 *
 * Covers add, remove, reorder, mapping-driven type locking, preset insertion
 * with de-duplication, and the save-time validation that maps issues back to
 * individual questions.
 *
 * @module tests/unit/app/calendar/meeting-type-booking-questions
 */
import { describe, expect, it } from 'vitest';

import { insertPreset } from '@/app/(dashboard)/calendar/meeting-type-booking-presets';
import {
  appendQuestion,
  clearMapping,
  moveQuestion,
  mappingsUsedElsewhere,
  removeQuestion,
  updateQuestion,
} from '@/app/(dashboard)/calendar/meeting-type-booking-questions';
import { validateBookingQuestions } from '@/app/(dashboard)/calendar/meeting-type-booking-validation';
import { QUESTION_PRESETS } from '@/lib/booking/question-presets';
import { QUESTION_LIMITS, type BookingQuestion } from '@/lib/booking/questions';

const q = (overrides: Partial<BookingQuestion> & { id: string; label: string }): BookingQuestion => ({
  type: 'short_text',
  required: false,
  ...overrides,
});

const WEDDING = QUESTION_PRESETS.find((p) => p.id === 'wedding')!;
const GENERAL = QUESTION_PRESETS.find((p) => p.id === 'general')!;

describe('add, remove and reorder', () => {
  it('appends a question without mutating the input list', () => {
    const before = [q({ id: 'a', label: 'Company' })];
    const next = appendQuestion(before, q({ id: 'b', label: 'Topic' }));
    expect(next.map((x) => x.id)).toEqual(['a', 'b']);
    expect(before).toHaveLength(1);
  });

  it('refuses to append past the maximum', () => {
    const full = Array.from({ length: QUESTION_LIMITS.maxQuestions }, (_, i) =>
      q({ id: `q${i}`, label: `Q${i}` }),
    );
    expect(appendQuestion(full, q({ id: 'extra', label: 'Extra' }))).toBe(full);
  });

  it('removes a question by id', () => {
    const list = [q({ id: 'a', label: 'A' }), q({ id: 'b', label: 'B' })];
    expect(removeQuestion(list, 'a').map((x) => x.id)).toEqual(['b']);
  });

  it('moves a question up and down, and ignores out-of-range moves', () => {
    const list = [q({ id: 'a', label: 'A' }), q({ id: 'b', label: 'B' }), q({ id: 'c', label: 'C' })];
    expect(moveQuestion(list, 2, -1).map((x) => x.id)).toEqual(['a', 'c', 'b']);
    expect(moveQuestion(list, 0, 1).map((x) => x.id)).toEqual(['b', 'a', 'c']);
    expect(moveQuestion(list, 0, -1)).toBe(list);
    expect(moveQuestion(list, 2, 1)).toBe(list);
  });
});

describe('mappings', () => {
  it('a mapping forces the question type to the mapping type', () => {
    const list = [q({ id: 'a', label: 'When?', type: 'short_text' })];
    const next = updateQuestion(list, 'a', { maps_to: 'event_date' });
    expect(next[0]).toMatchObject({ maps_to: 'event_date', type: 'date' });
  });

  it('clearing a mapping keeps the type it was given', () => {
    const list = [q({ id: 'a', label: 'When?', type: 'date', maps_to: 'event_date' })];
    const next = clearMapping(list, 'a');
    expect(next[0]).not.toHaveProperty('maps_to');
    expect(next[0]?.type).toBe('date');
  });

  it('reports mappings claimed by other questions only', () => {
    const list = [
      q({ id: 'a', label: 'Partner', maps_to: 'partner_name' }),
      q({ id: 'b', label: 'Venue', maps_to: 'venue' }),
    ];
    expect(mappingsUsedElsewhere(list, 'a')).toEqual(new Set(['venue']));
    expect(mappingsUsedElsewhere(list)).toEqual(new Set(['partner_name', 'venue']));
  });

  it('switching to a choice type seeds two options and switching away drops them', () => {
    const list = [q({ id: 'a', label: 'Pick' })];
    const choice = updateQuestion(list, 'a', { type: 'single_choice' });
    expect(choice[0]?.options).toEqual(['Option 1', 'Option 2']);

    const back = updateQuestion(choice, 'a', { type: 'short_text' });
    expect(back[0]).not.toHaveProperty('options');
  });
});

describe('insertPreset', () => {
  it('appends every question of an empty list with fresh ids', () => {
    const result = insertPreset([], WEDDING);
    expect(result.questions.map((x) => x.label)).toEqual(WEDDING.questions.map((x) => x.label));
    expect(result.skipped).toEqual([]);
    const presetIds = new Set(WEDDING.questions.map((x) => x.id));
    for (const question of result.questions) expect(presetIds.has(question.id)).toBe(false);
  });

  it('skips a preset question whose mapping is already used', () => {
    const existing = [q({ id: 'mine', label: 'Their partner', maps_to: 'partner_name' })];
    const result = insertPreset(existing, WEDDING);
    expect(result.questions.filter((x) => x.maps_to === 'partner_name')).toHaveLength(1);
    expect(result.skipped).toContain("Partner's name");
  });

  it('skips a question whose label already exists, ignoring case and spacing', () => {
    const existing = [q({ id: 'mine', label: '  VENUE ' })];
    const result = insertPreset(existing, WEDDING);
    expect(result.questions.filter((x) => x.label.trim().toLowerCase() === 'venue')).toHaveLength(1);
    expect(result.skipped).toContain('Venue');
  });

  it('does not let two questions from the same preset claim one mapping', () => {
    const result = insertPreset([], WEDDING);
    const mapped = result.questions.flatMap((x) => (x.maps_to ? [x.maps_to] : []));
    expect(new Set(mapped).size).toBe(mapped.length);
  });

  it('stops at the question limit', () => {
    const full = Array.from({ length: QUESTION_LIMITS.maxQuestions - 1 }, (_, i) =>
      q({ id: `q${i}`, label: `Filler ${i}` }),
    );
    const result = insertPreset(full, GENERAL);
    expect(result.questions).toHaveLength(QUESTION_LIMITS.maxQuestions);
    expect(result.skipped.length).toBeGreaterThan(0);
  });
});

describe('validateBookingQuestions', () => {
  it('passes a valid list', () => {
    expect(validateBookingQuestions([q({ id: 'a', label: 'Company' })])).toEqual({ ok: true });
  });

  it('attaches an empty label to its own question', () => {
    const list = [q({ id: 'a', label: 'Company' }), q({ id: 'b', label: '   ' })];
    const result = validateBookingQuestions(list);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.byId).toHaveProperty('b');
    expect(result.byId).not.toHaveProperty('a');
    expect(result.byId.b).toMatch(/label/i);
  });

  it('flags a choice question with fewer than two options', () => {
    const list = [q({ id: 'a', label: 'Pick', type: 'single_choice', options: ['Only one'] })];
    const result = validateBookingQuestions(list);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.byId.a).toMatch(/two options/i);
  });

  it('reports a field mapped by two questions as a list-level error', () => {
    const list = [
      q({ id: 'a', label: 'One', maps_to: 'venue' }),
      q({ id: 'b', label: 'Two', maps_to: 'venue' }),
    ];
    const result = validateBookingQuestions(list);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.formError).toBeDefined();
  });
});

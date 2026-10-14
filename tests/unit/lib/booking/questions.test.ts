/**
 * Booking question model: schema rules, answer validation, and the tolerant
 * parsers that read the jsonb columns.
 */
import { describe, expect, it } from 'vitest';

import { QUESTION_PRESETS, WEDDING_QUESTIONS } from '@/lib/booking/question-presets';
import {
  bookingQuestionsSchema,
  formatAnswerValue,
  newQuestionId,
  parseBookingAnswers,
  parseBookingQuestions,
  validateAnswers,
  type BookingQuestion,
} from '@/lib/booking/questions';

const QUESTIONS: BookingQuestion[] = [
  { id: 'partner', label: "Partner's name", type: 'short_text', required: true, maps_to: 'partner_name' },
  { id: 'date', label: 'Event date', type: 'date', required: false },
  { id: 'guests', label: 'Guests', type: 'number', required: false },
  { id: 'kind', label: 'Kind', type: 'single_choice', required: false, options: ['Wedding', 'Corporate'] },
  { id: 'extras', label: 'Extras', type: 'multi_choice', required: true, options: ['Mic', 'Lights', 'DJ'] },
];

describe('bookingQuestionsSchema', () => {
  it('accepts every preset', () => {
    for (const preset of QUESTION_PRESETS) {
      expect(bookingQuestionsSchema.safeParse(preset.questions).success).toBe(true);
    }
  });

  it('rejects a choice question with fewer than two options', () => {
    const q = [{ id: 'a', label: 'Pick', type: 'single_choice', required: false, options: ['Only'] }];
    expect(bookingQuestionsSchema.safeParse(q).success).toBe(false);
  });

  it('rejects a mapping onto the wrong input type', () => {
    const q = [{ id: 'a', label: 'When', type: 'short_text', required: false, maps_to: 'event_date' }];
    expect(bookingQuestionsSchema.safeParse(q).success).toBe(false);
  });

  it('rejects two questions filling the same field', () => {
    const q = [
      { id: 'a', label: 'Venue', type: 'short_text', required: false, maps_to: 'venue' },
      { id: 'b', label: 'Location', type: 'short_text', required: false, maps_to: 'venue' },
    ];
    expect(bookingQuestionsSchema.safeParse(q).success).toBe(false);
  });

  it('rejects duplicate ids and a blank label', () => {
    const dup = [
      { id: 'a', label: 'One', type: 'short_text', required: false },
      { id: 'a', label: 'Two', type: 'short_text', required: false },
    ];
    expect(bookingQuestionsSchema.safeParse(dup).success).toBe(false);
    expect(
      bookingQuestionsSchema.safeParse([{ id: 'a', label: '  ', type: 'short_text', required: false }]).success,
    ).toBe(false);
  });
});

describe('validateAnswers', () => {
  it('builds answers in question order with labels from the questions', () => {
    const { answers, errors } = validateAnswers(QUESTIONS, {
      extras: ['DJ', 'Mic'],
      partner: '  Sam  ',
      kind: 'Corporate',
      unknown: 'ignored',
    });
    expect(errors).toEqual({});
    expect(answers).toEqual([
      { question_id: 'partner', label: "Partner's name", type: 'short_text', value: 'Sam' },
      { question_id: 'kind', label: 'Kind', type: 'single_choice', value: 'Corporate' },
      // Kept in option order, not click order.
      { question_id: 'extras', label: 'Extras', type: 'multi_choice', value: ['Mic', 'DJ'] },
    ]);
  });

  it('flags missing required answers', () => {
    const { errors } = validateAnswers(QUESTIONS, { extras: ['Not an option'] });
    expect(Object.keys(errors).sort()).toEqual(['extras', 'partner']);
  });

  it('rejects malformed dates, numbers and off-list choices', () => {
    const { errors } = validateAnswers(QUESTIONS, {
      partner: 'Sam',
      extras: ['Mic'],
      date: '2026-02-30',
      guests: 'about 80',
      kind: 'Birthday',
    });
    expect(Object.keys(errors).sort()).toEqual(['date', 'guests', 'kind']);
  });

  it('accepts a real date and a decimal number', () => {
    const { errors, answers } = validateAnswers(QUESTIONS, {
      partner: 'Sam',
      extras: ['Mic'],
      date: '2027-03-14',
      guests: '120',
    });
    expect(errors).toEqual({});
    expect(answers.map((a) => a.question_id)).toEqual(['partner', 'date', 'guests', 'extras']);
  });
});

describe('parsers', () => {
  it('drops malformed questions instead of failing the list', () => {
    const parsed = parseBookingQuestions([
      ...WEDDING_QUESTIONS,
      { id: 'bad', type: 'nope' },
      'not an object',
    ]);
    expect(parsed.map((q) => q.id)).toEqual(WEDDING_QUESTIONS.map((q) => q.id));
    expect(parseBookingQuestions(null)).toEqual([]);
  });

  it('drops malformed answers', () => {
    const parsed = parseBookingAnswers([
      { question_id: 'a', label: 'A', type: 'short_text', value: 'x' },
      { question_id: 'b', label: 'B', type: 'multi_choice', value: [1, 2] },
      { label: 'C', type: 'short_text', value: 'x' },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parseBookingAnswers({})).toEqual([]);
  });
});

describe('helpers', () => {
  it('formats list answers as a comma list', () => {
    expect(formatAnswerValue({ value: ['Mic', 'DJ'] })).toBe('Mic, DJ');
    expect(formatAnswerValue({ value: 'Sam' })).toBe('Sam');
  });

  it('mints distinct ids', () => {
    const ids = new Set(Array.from({ length: 50 }, newQuestionId));
    expect(ids.size).toBe(50);
  });
});

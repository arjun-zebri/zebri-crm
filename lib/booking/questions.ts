/**
 * Booking form questions: the per-meeting-type fields a booker answers.
 *
 * The public booking form has a small fixed core (name, email, phone, notes)
 * that every industry needs. Everything else is a question the business
 * defines on the meeting type and stores in `meeting_types.questions`. A
 * wedding MC asks for a partner's name and a wedding date; a consultant asks
 * for a company. Nothing in the schema assumes either.
 *
 * Answers are stored on `bookings.answers` with the question's label and type
 * copied in, so a booking still reads correctly after the question is renamed
 * or deleted.
 *
 * This module is shared by the meeting-type editor, the public form, and the
 * submit route. The `submit_booking` RPC re-applies the same rules in SQL
 * because it is anon-callable; keep the limits here and there in step.
 *
 * @module lib/booking/questions
 */
import { z } from 'zod';

/** Every control a booking question can render as. */
export const BOOKING_QUESTION_TYPES = [
  'short_text',
  'long_text',
  'date',
  'number',
  'single_choice',
  'multi_choice',
] as const;

/** The control a booking question renders as. */
export type BookingQuestionType = (typeof BOOKING_QUESTION_TYPES)[number];

/** Human labels for {@link BookingQuestionType}, for the editor's type picker. */
export const QUESTION_TYPE_LABELS: Record<BookingQuestionType, string> = {
  short_text: 'Short answer',
  long_text: 'Paragraph',
  date: 'Date',
  number: 'Number',
  single_choice: 'Single choice',
  multi_choice: 'Multiple choice',
};

/**
 * Contact-record fields an answer can also fill when the booking creates a
 * new contact. Optional: most questions map to nothing and land in notes.
 */
export const QUESTION_MAPPINGS = ['partner_name', 'event_date', 'venue'] as const;

/** A contact-record field a question's answer is copied into. */
export type QuestionMapping = (typeof QUESTION_MAPPINGS)[number];

/** Human labels for {@link QuestionMapping}. */
export const QUESTION_MAPPING_LABELS: Record<QuestionMapping, string> = {
  partner_name: "Partner's name",
  event_date: 'Event date',
  venue: 'Venue',
};

/**
 * The input type each mapping needs. An event date has to be a real date to
 * land in a date column, so the editor locks the type once a mapping is set.
 */
export const MAPPING_QUESTION_TYPE: Record<QuestionMapping, BookingQuestionType> = {
  partner_name: 'short_text',
  event_date: 'date',
  venue: 'short_text',
};

/** How the fixed phone field behaves on a meeting type's form. */
export const PHONE_FIELD_MODES = ['hidden', 'optional', 'required'] as const;

/** How the fixed phone field behaves on a meeting type's form. */
export type PhoneFieldMode = (typeof PHONE_FIELD_MODES)[number];

/** Limits shared with the `submit_booking` RPC. Change both together. */
export const QUESTION_LIMITS = {
  maxQuestions: 20,
  maxOptions: 20,
  labelLength: 200,
  helpLength: 300,
  optionLength: 100,
  answerLength: 2000,
} as const;

const isChoice = (type: BookingQuestionType) =>
  type === 'single_choice' || type === 'multi_choice';

/** One question as stored in `meeting_types.questions`. */
export const bookingQuestionSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    label: z.string().trim().min(1, 'Every question needs a label').max(QUESTION_LIMITS.labelLength),
    type: z.enum(BOOKING_QUESTION_TYPES),
    required: z.boolean().default(false),
    help: z.string().trim().max(QUESTION_LIMITS.helpLength).optional(),
    options: z
      .array(z.string().trim().min(1).max(QUESTION_LIMITS.optionLength))
      .max(QUESTION_LIMITS.maxOptions)
      .optional(),
    maps_to: z.enum(QUESTION_MAPPINGS).optional(),
  })
  .refine((q) => !isChoice(q.type) || (q.options?.length ?? 0) >= 2, {
    message: 'A choice question needs at least two options',
    path: ['options'],
  })
  .refine((q) => !q.maps_to || MAPPING_QUESTION_TYPE[q.maps_to] === q.type, {
    message: 'This question type cannot fill that field',
    path: ['maps_to'],
  });

/** One question as stored in `meeting_types.questions`. */
export type BookingQuestion = z.output<typeof bookingQuestionSchema>;

/** A meeting type's full question list, in display order. */
export const bookingQuestionsSchema = z
  .array(bookingQuestionSchema)
  .max(QUESTION_LIMITS.maxQuestions)
  .refine((qs) => new Set(qs.map((q) => q.id)).size === qs.length, 'Question ids must be unique')
  .refine(
    (qs) => {
      const mapped = qs.flatMap((q) => (q.maps_to ? [q.maps_to] : []));
      return new Set(mapped).size === mapped.length;
    },
    'Each field can only be filled by one question',
  );

/** A raw answer: a string, or a list of chosen options for `multi_choice`. */
export type AnswerValue = string | string[];

/** One answer as stored in `bookings.answers`. */
export interface BookingAnswer {
  question_id: string;
  /** The question's label at the time of booking. */
  label: string;
  type: BookingQuestionType;
  value: AnswerValue;
}

/**
 * Read a stored question list, dropping anything malformed.
 *
 * The column is jsonb, so a bad row must not take the public page down:
 * an invalid question is skipped rather than failing the whole list.
 *
 * @param raw - the `questions` value from the database
 */
export function parseBookingQuestions(raw: unknown): BookingQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((q) => {
    const parsed = bookingQuestionSchema.safeParse(q);
    return parsed.success ? [parsed.data] : [];
  });
}

/**
 * Read stored answers, dropping anything malformed. See {@link parseBookingQuestions}.
 *
 * @param raw - the `answers` value from the database
 */
export function parseBookingAnswers(raw: unknown): BookingAnswer[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((a): BookingAnswer[] => {
    if (!a || typeof a !== 'object') return [];
    const { question_id, label, type, value } = a as Record<string, unknown>;
    if (typeof question_id !== 'string' || typeof label !== 'string') return [];
    if (!BOOKING_QUESTION_TYPES.includes(type as BookingQuestionType)) return [];
    const ok =
      typeof value === 'string' ||
      (Array.isArray(value) && value.every((v) => typeof v === 'string'));
    if (!ok) return [];
    return [{ question_id, label, type: type as BookingQuestionType, value: value as AnswerValue }];
  });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER_RE = /^-?\d+(\.\d+)?$/;

/** True when `value` is a real calendar date in `YYYY-MM-DD` form. */
function isRealDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Result of {@link validateAnswers}. */
export interface AnswerValidation {
  /** Clean answers in question order, empty ones omitted. */
  answers: BookingAnswer[];
  /** Error message per question id; empty when everything is valid. */
  errors: Record<string, string>;
}

/**
 * Check raw answers against a question list and build the stored shape.
 *
 * Labels and types come from the questions, never from the input, so a
 * booker cannot relabel an answer. Unknown question ids are ignored.
 *
 * @param questions - the meeting type's questions
 * @param raw - answers keyed by question id
 */
export function validateAnswers(
  questions: BookingQuestion[],
  raw: Record<string, AnswerValue | undefined>,
): AnswerValidation {
  const answers: BookingAnswer[] = [];
  const errors: Record<string, string> = {};

  for (const q of questions) {
    const input = raw[q.id];
    let value: AnswerValue | null = null;

    if (q.type === 'multi_choice') {
      const picked = Array.isArray(input) ? input : [];
      const allowed = q.options ?? [];
      const kept = allowed.filter((o) => picked.includes(o));
      value = kept.length > 0 ? kept : null;
    } else {
      const text = (typeof input === 'string' ? input : '').trim();
      if (text !== '') {
        if (text.length > QUESTION_LIMITS.answerLength) {
          errors[q.id] = `Keep this under ${QUESTION_LIMITS.answerLength} characters`;
          continue;
        }
        if (q.type === 'date' && !isRealDate(text)) {
          errors[q.id] = 'Enter a valid date';
          continue;
        }
        if (q.type === 'number' && !NUMBER_RE.test(text)) {
          errors[q.id] = 'Enter a number';
          continue;
        }
        if (q.type === 'single_choice' && !(q.options ?? []).includes(text)) {
          errors[q.id] = 'Choose one of the options';
          continue;
        }
        value = text;
      }
    }

    if (value === null) {
      if (q.required) errors[q.id] = q.type === 'multi_choice' || q.type === 'single_choice'
        ? 'Choose an option'
        : 'This one is required';
      continue;
    }

    answers.push({ question_id: q.id, label: q.label, type: q.type, value });
  }

  return { answers, errors };
}

/**
 * Render an answer as plain text, for emails, calendar events and notes.
 * Dates render unchanged (`YYYY-MM-DD`) because the reader's locale is unknown here.
 */
export function formatAnswerValue(answer: Pick<BookingAnswer, 'value'>): string {
  return Array.isArray(answer.value) ? answer.value.join(', ') : answer.value;
}

/**
 * A fresh, short question id. Ids only need to be unique within one meeting
 * type, and they appear in stored answers, so short and readable wins.
 */
export function newQuestionId(): string {
  return `q_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Client-side checks for the booking details form.
 *
 * The server re-checks everything (the submit route and the `submit_booking`
 * RPC), so this exists to tell the couple what is wrong before a round trip
 * and to say it next to the field. It is deliberately the same rules as the
 * server, not looser ones: a form that lets a bad value through only swaps a
 * useful inline message for a generic one after the press.
 *
 * @module app/book/[token]/details-validation
 */
import {
  validateAnswers,
  type AnswerValue,
  type BookingQuestion,
  type PhoneFieldMode,
} from '@/lib/booking/questions'

/** Longest name the server accepts. */
export const NAME_MAX = 120;
/** Longest notes the server accepts. */
export const NOTES_MAX = 2000;

/** Pragmatic address check: something@something.tld, no spaces. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The raw values as the couple typed them. */
export interface DetailsInput {
  name: string;
  email: string;
  phone: string;
  notes: string;
  /** Answers keyed by question id. */
  answers: Record<string, AnswerValue | undefined>;
}

/** Values ready to send: trimmed, with empty optionals dropped. */
export interface CleanDetails {
  name: string;
  email: string;
  phone: string | undefined;
  notes: string | undefined;
  answers: Array<{ question_id: string; value: AnswerValue }>;
}

/** Result of {@link validateDetails}. `clean` is null whenever `errors` is non-empty. */
export interface DetailsValidation {
  errors: Record<string, string>;
  clean: CleanDetails | null;
}

/**
 * The fields in the order they appear on the form. Used to pick the first
 * invalid field to focus, so focus lands where the eye starts reading.
 *
 * @param questions - the meeting type's questions, in display order
 * @param phoneField - how the phone field behaves
 */
export function fieldOrder(questions: BookingQuestion[], phoneField: PhoneFieldMode): string[] {
  const head = phoneField === 'hidden' ? ['name', 'email'] : ['name', 'email', 'phone'];
  return [...head, ...questions.map((q) => q.id), 'notes'];
}

/**
 * Validate and clean the details form.
 *
 * @param input - the raw form values
 * @param questions - the meeting type's questions
 * @param phoneField - `hidden` drops the phone value entirely, even if typed
 */
export function validateDetails(
  input: DetailsInput,
  questions: BookingQuestion[],
  phoneField: PhoneFieldMode,
): DetailsValidation {
  const errors: Record<string, string> = {};

  const name = input.name.trim();
  if (name === '') errors.name = 'Enter your name';
  else if (name.length > NAME_MAX) errors.name = `Keep your name under ${NAME_MAX} characters`;

  const email = input.email.trim();
  if (email === '') errors.email = 'Enter your email address';
  else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address, like name@example.com';

  const phone = phoneField === 'hidden' ? '' : input.phone.trim();
  if (phoneField === 'required' && phone === '') errors.phone = 'Enter a phone number so we can reach you';

  const notes = input.notes.trim();
  if (notes.length > NOTES_MAX) errors.notes = `Keep notes under ${NOTES_MAX} characters`;

  const answered = validateAnswers(questions, input.answers);
  Object.assign(errors, answered.errors);

  if (Object.keys(errors).length > 0) return { errors, clean: null };

  return {
    errors,
    clean: {
      name,
      email,
      phone: phone === '' ? undefined : phone,
      notes: notes === '' ? undefined : notes,
      answers: answered.answers.map((a) => ({ question_id: a.question_id, value: a.value })),
    },
  };
}

/**
 * The first field in form order that has an error, or undefined. A server
 * error keyed to something the form does not render is skipped, not focused.
 *
 * @param order - from {@link fieldOrder}
 * @param errors - messages keyed by field
 */
export function firstInvalidField(order: string[], errors: Record<string, string>): string | undefined {
  return order.find((key) => Boolean(errors[key]));
}

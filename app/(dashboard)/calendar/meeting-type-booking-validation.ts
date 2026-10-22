/**
 * Save-time validation for the meeting type editor's booking questions.
 *
 * Runs the shared `bookingQuestionsSchema` and maps each issue back to the
 * question it belongs to, so the editor can show the message on that row.
 *
 * @module app/(dashboard)/calendar/meeting-type-booking-validation
 */
import { bookingQuestionsSchema, type BookingQuestion } from '@/lib/booking/questions';

/** Result of {@link validateBookingQuestions}. */
export type BookingQuestionsValidation =
  | { ok: true }
  | {
      ok: false;
      /** Message per question id, shown on that question's row. */
      byId: Record<string, string>;
      /** List-level problem (duplicate mappings, too many questions), shown above the list. */
      formError?: string;
    };

/**
 * Run the shared question schema and map each issue back to its question.
 *
 * Issues at a question's index land on that question; anything else (for
 * example two questions mapping to the same field) is a list-level error.
 *
 * @param questions - the current list
 */
export function validateBookingQuestions(questions: BookingQuestion[]): BookingQuestionsValidation {
  const parsed = bookingQuestionsSchema.safeParse(questions);
  if (parsed.success) return { ok: true };

  const byId: Record<string, string> = {};
  let formError: string | undefined;
  for (const issue of parsed.error.issues) {
    const index = issue.path[0];
    const question = typeof index === 'number' ? questions[index] : undefined;
    if (question) {
      byId[question.id] ??= issue.message;
    } else {
      formError ??= issue.message;
    }
  }
  return formError ? { ok: false, byId, formError } : { ok: false, byId };
}

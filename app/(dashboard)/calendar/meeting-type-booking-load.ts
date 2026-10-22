/**
 * Reading stored booking questions into the editor.
 *
 * @module app/(dashboard)/calendar/meeting-type-booking-load
 */
import { z } from 'zod';

import { BOOKING_QUESTION_TYPES, QUESTION_MAPPINGS, type BookingQuestion } from '@/lib/booking/questions';

/**
 * Shape check for a stored question, without the content rules.
 *
 * The public form drops anything invalid, which is right for a booker. The
 * editor must not: a question saved with one option would otherwise vanish
 * on open, and the next Save would delete it with no message. Loading it
 * leniently lets {@link validateBookingQuestions} point at the problem.
 */
const storedQuestionShape = z.object({
  id: z.string().min(1),
  label: z.string(),
  type: z.enum(BOOKING_QUESTION_TYPES),
  required: z.boolean().optional(),
  help: z.string().optional(),
  options: z.array(z.string()).optional(),
  maps_to: z.enum(QUESTION_MAPPINGS).optional(),
});

/**
 * Read stored questions for the editor, keeping any that are structurally
 * readable even if they break a content rule.
 *
 * @param raw - the `questions` value from the database
 * @returns questions in stored order; unreadable entries are skipped
 */
export function loadQuestionsForEditor(raw: unknown): BookingQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const parsed = storedQuestionShape.safeParse(item);
    if (!parsed.success) return [];
    const { required, ...rest } = parsed.data;
    return [{ ...rest, required: required ?? false }];
  });
}

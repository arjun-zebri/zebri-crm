/**
 * Pure list operations for the meeting type editor's booking questions.
 *
 * Every function returns a new array and never mutates its input, so the
 * modal's reducer state stays safe to compare and the helpers can be unit
 * tested without React. Limits and mapping rules come from
 * `@/lib/booking/questions`; this file only decides how the editor applies them.
 *
 * @module app/(dashboard)/calendar/meeting-type-booking-questions
 */
import {
  MAPPING_QUESTION_TYPE,
  newQuestionId,
  QUESTION_LIMITS,
  type BookingQuestion,
  type BookingQuestionType,
  type QuestionMapping,
} from '@/lib/booking/questions';

/** Option labels a choice question starts with, so it passes validation after one edit. */
const SEED_OPTIONS = ['Option 1', 'Option 2'];

/** True for the two types that carry an options list. */
export function isChoiceType(type: BookingQuestionType): boolean {
  return type === 'single_choice' || type === 'multi_choice';
}

/**
 * A blank question for the "Add question" button.
 *
 * @returns a short-text question with a fresh id, not yet required
 */
export function blankQuestion(): BookingQuestion {
  return { id: newQuestionId(), label: '', type: 'short_text', required: false };
}

/**
 * Mappings already claimed by a question other than `exceptId`.
 *
 * Used to disable mapping options in the editor and to skip duplicates when a
 * preset is inserted.
 *
 * @param questions - the current list
 * @param exceptId - the question being edited, so its own mapping stays selectable
 */
export function mappingsUsedElsewhere(
  questions: BookingQuestion[],
  exceptId?: string,
): Set<QuestionMapping> {
  const used = new Set<QuestionMapping>();
  for (const q of questions) {
    if (q.maps_to && q.id !== exceptId) used.add(q.maps_to);
  }
  return used;
}

/**
 * Apply a change to one question.
 *
 * Two rules keep the list valid as it is edited:
 * - Choosing a mapping forces the question type to the mapping's type, and
 *   clearing the mapping leaves the type as it was.
 * - Switching to a choice type seeds two options, and switching away from one
 *   drops the options so they do not linger in storage.
 *
 * @param questions - the current list
 * @param id - the question to change
 * @param patch - the fields to change
 */
export function updateQuestion(
  questions: BookingQuestion[],
  id: string,
  patch: Partial<BookingQuestion>,
): BookingQuestion[] {
  return questions.map((q) => {
    if (q.id !== id) return q;
    const next: BookingQuestion = { ...q, ...patch };

    if (patch.maps_to !== undefined) {
      next.type = MAPPING_QUESTION_TYPE[patch.maps_to];
    }
    if (patch.type !== undefined && patch.maps_to === undefined) {
      if (isChoiceType(patch.type)) {
        if (!q.options || q.options.length < 2) next.options = [...SEED_OPTIONS];
      } else {
        delete next.options;
      }
    }
    return next;
  });
}

/**
 * Clear a mapping. Split from {@link updateQuestion} because `undefined` in a
 * patch means "leave alone", not "remove", and removal needs `delete`.
 *
 * @param questions - the current list
 * @param id - the question to unmap
 */
export function clearMapping(questions: BookingQuestion[], id: string): BookingQuestion[] {
  return questions.map((q) => {
    if (q.id !== id) return q;
    const next: BookingQuestion = { ...q };
    delete next.maps_to;
    return next;
  });
}

/**
 * Remove a question by id.
 *
 * @param questions - the current list
 * @param id - the question to delete
 */
export function removeQuestion(questions: BookingQuestion[], id: string): BookingQuestion[] {
  return questions.filter((q) => q.id !== id);
}

/**
 * Move a question one place up or down. Out-of-range moves return the list unchanged.
 *
 * @param questions - the current list
 * @param index - the question's current index
 * @param direction - `-1` for up, `1` for down
 */
export function moveQuestion(
  questions: BookingQuestion[],
  index: number,
  direction: -1 | 1,
): BookingQuestion[] {
  const target = index + direction;
  if (index < 0 || target < 0 || target >= questions.length) return questions;
  const next = [...questions];
  const [moved] = next.splice(index, 1);
  if (moved) next.splice(target, 0, moved);
  return next;
}

/**
 * Append a question, respecting the list limit.
 *
 * @param questions - the current list
 * @param question - the question to append
 */
export function appendQuestion(
  questions: BookingQuestion[],
  question: BookingQuestion,
): BookingQuestion[] {
  if (questions.length >= QUESTION_LIMITS.maxQuestions) return questions;
  return [...questions, question];
}

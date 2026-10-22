/**
 * Inserting a preset into a meeting type's booking questions.
 *
 * Split from the list helpers so each file stays small. A preset is data; this
 * module decides which of its questions are safe to add to a list that may
 * already hold some of them.
 *
 * @module app/(dashboard)/calendar/meeting-type-booking-presets
 */
import type { QuestionPreset } from '@/lib/booking/question-presets';
import { newQuestionId, QUESTION_LIMITS, type BookingQuestion } from '@/lib/booking/questions';

import { mappingsUsedElsewhere } from './meeting-type-booking-questions';

/**
 * Result of {@link insertPreset}: the new list and what was skipped, so the
 * editor can say why a preset added fewer questions than it has.
 */
export interface PresetInsertResult {
  questions: BookingQuestion[];
  /** Labels of preset questions that were not added. */
  skipped: string[];
}

/**
 * Append a preset's questions with fresh ids.
 *
 * A preset question is skipped when its mapping is already used, when a
 * question with the same label (case-insensitive) exists, or when the list is
 * full. Skipping rather than failing lets a wedding preset land on a meeting
 * type that already asks for the partner's name.
 *
 * @param questions - the current list
 * @param preset - the preset to insert
 */
export function insertPreset(
  questions: BookingQuestion[],
  preset: QuestionPreset,
): PresetInsertResult {
  const mapped = mappingsUsedElsewhere(questions);
  const labels = new Set(questions.map((q) => q.label.trim().toLowerCase()));
  const next = [...questions];
  const skipped: string[] = [];

  for (const candidate of preset.questions) {
    const key = candidate.label.trim().toLowerCase();
    const mappingTaken = candidate.maps_to !== undefined && mapped.has(candidate.maps_to);
    if (mappingTaken || labels.has(key) || next.length >= QUESTION_LIMITS.maxQuestions) {
      skipped.push(candidate.label);
      continue;
    }
    next.push({ ...candidate, id: newQuestionId() });
    labels.add(key);
    if (candidate.maps_to) mapped.add(candidate.maps_to);
  }

  return { questions: next, skipped };
}

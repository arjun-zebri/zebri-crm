'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { QuestionPreset } from '@/lib/booking/question-presets';
import { QUESTION_LIMITS, type BookingQuestion } from '@/lib/booking/questions';

import { BookingPresetMenu } from './booking-preset-menu';
import { BookingQuestionRow } from './booking-question-row';
import { insertPreset } from './meeting-type-booking-presets';
import {
  appendQuestion,
  blankQuestion,
  clearMapping,
  moveQuestion,
  mappingsUsedElsewhere,
  removeQuestion,
  updateQuestion,
} from './meeting-type-booking-questions';

interface BookingQuestionListProps {
  questions: BookingQuestion[];
  /** Replace the whole list. */
  onChange: (questions: BookingQuestion[]) => void;
  /** Message per question id, from the last failed save. */
  errorsById: Record<string, string>;
  /** List-level message, e.g. two questions saving to the same field. */
  formError?: string | undefined;
}

/**
 * The reorderable list of extra booking questions, with add and preset actions.
 *
 * Only one row is expanded at a time, which keeps a long list scannable on a
 * phone. A newly added question opens straight away so the MC can name it.
 *
 * @module app/(dashboard)/calendar/booking-question-list
 */
export function BookingQuestionList({
  questions,
  onChange,
  errorsById,
  formError,
}: BookingQuestionListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [presetNote, setPresetNote] = useState<string | null>(null);
  const atLimit = questions.length >= QUESTION_LIMITS.maxQuestions;

  const add = () => {
    const question = blankQuestion();
    setPresetNote(null);
    setExpandedId(question.id);
    onChange(appendQuestion(questions, question));
  };

  const addPreset = (preset: QuestionPreset) => {
    const result = insertPreset(questions, preset);
    setExpandedId(null);
    setPresetNote(
      result.skipped.length > 0
        ? `Skipped ${result.skipped.join(', ')}. ${result.skipped.length === 1 ? 'It is' : 'They are'} already asked or the list is full.`
        : null,
    );
    onChange(result.questions);
  };

  return (
    <div className="space-y-2">
      {questions.length === 0 && (
        <p className="text-body text-text-muted">
          No extra questions. Most meetings need nothing more than name and email.
        </p>
      )}

      {questions.map((question, index) => (
        <BookingQuestionRow
          key={question.id}
          question={question}
          index={index}
          count={questions.length}
          expanded={expandedId === question.id}
          onToggleExpanded={() =>
            setExpandedId((current) => (current === question.id ? null : question.id))
          }
          onMove={(direction) => onChange(moveQuestion(questions, index, direction))}
          onRemove={() => {
            if (expandedId === question.id) setExpandedId(null);
            onChange(removeQuestion(questions, question.id));
          }}
          mappingsTaken={mappingsUsedElsewhere(questions, question.id)}
          onChange={(patch) => onChange(updateQuestion(questions, question.id, patch))}
          onClearMapping={() => onChange(clearMapping(questions, question.id))}
          error={errorsById[question.id]}
        />
      ))}

      {formError && (
        <p role="alert" className="text-body text-danger">
          {formError}
        </p>
      )}
      {presetNote && <p className="text-body text-text-muted">{presetNote}</p>}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button variant="secondary" onClick={add} disabled={atLimit}>
          <Plus size={16} strokeWidth={1.5} />
          Add question
        </Button>
        <BookingPresetMenu disabled={atLimit} onPick={addPreset} />
        <span className="text-body text-text-muted tabular-nums">
          {questions.length} of {QUESTION_LIMITS.maxQuestions}
        </span>
      </div>
    </div>
  );
}

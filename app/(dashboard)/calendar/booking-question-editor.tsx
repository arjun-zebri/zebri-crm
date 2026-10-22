'use client';

import { Input } from '@/components/ui/input';
import { Select, type SelectOption } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import {
  BOOKING_QUESTION_TYPES,
  QUESTION_LIMITS,
  QUESTION_MAPPING_LABELS,
  QUESTION_MAPPINGS,
  QUESTION_TYPE_LABELS,
  type BookingQuestion,
  type BookingQuestionType,
  type QuestionMapping,
} from '@/lib/booking/questions';

import { BookingQuestionOptions } from './booking-question-options';
import { isChoiceType } from './meeting-type-booking-questions';

const NO_MAPPING = 'none';

interface BookingQuestionEditorProps {
  question: BookingQuestion;
  /** Mappings another question already claims. Those options are disabled here. */
  mappingsTaken: Set<QuestionMapping>;
  /** Apply a field change to this question. */
  onChange: (patch: Partial<BookingQuestion>) => void;
  /** Clear this question's contact mapping. */
  onClearMapping: () => void;
  /** Validation message for this question, shown under the fields. */
  error?: string | undefined;
}

const TYPE_OPTIONS: SelectOption[] = BOOKING_QUESTION_TYPES.map((type) => ({
  value: type,
  label: QUESTION_TYPE_LABELS[type],
}));

/**
 * The expanded editor for one booking question.
 *
 * A question with a contact mapping has its type locked, because the mapping
 * decides the type (an event date must be a date to land in a date column).
 *
 * @module app/(dashboard)/calendar/booking-question-editor
 */
export function BookingQuestionEditor({
  question,
  mappingsTaken,
  onChange,
  onClearMapping,
  error,
}: BookingQuestionEditorProps) {
  const mappingOptions: SelectOption[] = [
    { value: NO_MAPPING, label: 'None' },
    ...QUESTION_MAPPINGS.map((m) => ({
      value: m,
      label: QUESTION_MAPPING_LABELS[m],
      disabled: mappingsTaken.has(m),
    })),
  ];

  // Radix can emit an empty value on mount inside a form (see the phone select
  // in meeting-type-booking-form-fields), so empty values are ignored here.
  const setType = (value: string) => {
    if (value) onChange({ type: value as BookingQuestionType });
  };

  const setMapping = (value: string) => {
    if (!value) return;
    if (value === NO_MAPPING) {
      onClearMapping();
      return;
    }
    onChange({ maps_to: value as QuestionMapping });
  };

  const isChoice = isChoiceType(question.type);

  return (
    <div className="space-y-3">
      <Input
        label="Question"
        placeholder="e.g. Which venue are you looking at?"
        value={question.label}
        maxLength={QUESTION_LIMITS.labelLength}
        onChange={(e) => onChange({ label: e.target.value })}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Answer type"
          value={question.type}
          onValueChange={setType}
          options={TYPE_OPTIONS}
          disabled={question.maps_to !== undefined}
          {...(question.maps_to && { help: 'Set by the contact field below' })}
        />
        <Select
          label="Also save to contact as"
          value={question.maps_to ?? NO_MAPPING}
          onValueChange={setMapping}
          options={mappingOptions}
        />
      </div>

      <Input
        label="Help text"
        placeholder="Optional hint shown under the question"
        value={question.help ?? ''}
        maxLength={QUESTION_LIMITS.helpLength}
        onChange={(e) => onChange({ help: e.target.value })}
      />

      {isChoice && (
        <BookingQuestionOptions
          options={question.options ?? []}
          onChange={(options) => onChange({ options })}
        />
      )}

      <Toggle
        checked={question.required}
        onChange={(required) => onChange({ required })}
        label="Required"
        description="The booker cannot submit without an answer."
      />

      {error && (
        <p role="alert" className="text-body text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

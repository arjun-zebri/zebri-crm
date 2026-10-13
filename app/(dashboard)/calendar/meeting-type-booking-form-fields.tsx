'use client';

import { Select, type SelectOption } from '@/components/ui/select';
import type { BookingQuestion, PhoneFieldMode } from '@/lib/booking/questions';

import { BookingQuestionList } from './booking-question-list';

const PHONE_OPTIONS: SelectOption[] = [
  { value: 'hidden', label: "Don't ask" },
  { value: 'optional', label: 'Optional' },
  { value: 'required', label: 'Required' },
];

interface MeetingTypeBookingFormFieldsProps {
  phoneField: PhoneFieldMode;
  setPhoneField: (value: PhoneFieldMode) => void;
  questions: BookingQuestion[];
  setQuestions: (questions: BookingQuestion[]) => void;
  /** Message per question id, from the last failed save. */
  questionErrors: Record<string, string>;
  /** List-level message from the last failed save. */
  questionsFormError?: string | undefined;
}

/**
 * The "Booking form" section of the meeting type modal: the phone field
 * behaviour and the list of extra questions.
 *
 * Name and email are fixed and always asked, so the explainer says so up front
 * rather than leaving the MC to wonder why they cannot be turned off.
 *
 * @module app/(dashboard)/calendar/meeting-type-booking-form-fields
 */
export function MeetingTypeBookingFormFields({
  phoneField,
  setPhoneField,
  questions,
  setQuestions,
  questionErrors,
  questionsFormError,
}: MeetingTypeBookingFormFieldsProps) {
  return (
    <section className="space-y-4 border-t border-border pt-4">
      <div className="space-y-1">
        <h3 className="text-section font-semibold text-text">Booking form</h3>
        <p className="text-body text-text-muted">
          Name and email are always asked. Add anything else you need to know before the meeting.
        </p>
      </div>

      <Select
        label="Phone"
        value={phoneField}
        onValueChange={(value) => {
          // Radix can report an empty value on mount when the Select sits in a
          // form, before its options register. Ignore it rather than storing ''.
          if (value) setPhoneField(value as PhoneFieldMode);
        }}
        options={PHONE_OPTIONS}
      />

      <BookingQuestionList
        questions={questions}
        onChange={setQuestions}
        errorsById={questionErrors}
        formError={questionsFormError}
      />
    </section>
  );
}

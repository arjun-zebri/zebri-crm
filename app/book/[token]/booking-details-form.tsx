/**
 * The details step's form: name, email, phone, the meeting type's questions,
 * and notes.
 *
 * The submit button is never disabled. Pressing it runs the checks, puts each
 * message beside its field, and moves focus to the first problem. A server
 * rejection goes through the same path, so a couple never meets a second kind
 * of error. The honeypot and the form-fill timer stay here, as on the old form.
 *
 * @module app/book/[token]/booking-details-form
 */
'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { AnswerValue, BookingQuestion, PhoneFieldMode } from '@/lib/booking/questions'

import { BookingQuestionField, groupQuestionRows } from './booking-question-field'
import { fieldOrder, firstInvalidField, validateDetails, type CleanDetails } from './details-validation'
import type { SubmitPayload, SubmitResult } from './use-booking-page'

export interface BookingDetailsFormProps {
  questions: BookingQuestion[];
  phoneField: PhoneFieldMode;
  /** True while the booking is being sent. */
  loading: boolean;
  /** Sends the cleaned details. Resolves with any server errors to show. */
  onSubmit: (payload: Omit<SubmitPayload, 'token'>) => Promise<SubmitResult>;
}

/** Field values the form owns directly (questions are kept separately). */
interface FieldValues {
  name: string;
  email: string;
  phone: string;
  notes: string;
  website: string;
}

const EMPTY_VALUES: FieldValues = { name: '', email: '', phone: '', notes: '', website: '' };

/**
 * Drop one key from an errors map without mutating it.
 *
 * @param errors - the current messages
 * @param key - the field whose message is cleared
 */
function withoutKey(errors: Record<string, string>, key: string): Record<string, string> {
  if (!(key in errors)) return errors;
  const next = { ...errors };
  delete next[key];
  return next;
}

/** Form for the details step. See the module docs for the submit behaviour. */
export function BookingDetailsForm({ questions, phoneField, loading, onSubmit }: BookingDetailsFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const startedAtRef = useRef(0);
  useEffect(() => {
    // Minted on mount, not per render: the server measures fill time from here.
    startedAtRef.current = Date.now();
  }, []);

  const [values, setValues] = useState<FieldValues>(EMPTY_VALUES);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const setValue = (key: keyof FieldValues, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => withoutKey(e, key));
  };
  const setAnswer = (id: string, value: AnswerValue) => {
    setAnswers((a) => ({ ...a, [id]: value }));
    setErrors((e) => withoutKey(e, id));
  };

  /** Moves focus to a field by its key. The form marks each row with `data-booking-field`. */
  const focusField = (key: string | undefined) => {
    if (!key || !formRef.current) return;
    const row = Array.from(formRef.current.querySelectorAll<HTMLElement>('[data-booking-field]'))
      .find((el) => el.dataset.bookingField === key);
    row?.querySelector<HTMLElement>('input, textarea, button')?.focus();
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    const order = fieldOrder(questions, phoneField);
    const checked = validateDetails({ ...values, answers }, questions, phoneField);
    if (!checked.clean) {
      setFormError(null);
      setErrors(checked.errors);
      focusField(firstInvalidField(order, checked.errors));
      return;
    }
    setErrors({});
    setFormError(null);
    const clean: CleanDetails = checked.clean;
    const result = await onSubmit({
      name: clean.name,
      email: clean.email,
      phone: clean.phone,
      notes: clean.notes,
      answers: clean.answers,
      startedAt: startedAtRef.current,
    });
    if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
      setErrors(result.fieldErrors);
      focusField(firstInvalidField(order, result.fieldErrors));
    }
    if (result.formError) setFormError(result.formError);
  }

  const showPhone = phoneField !== 'hidden';
  const rows = groupQuestionRows(questions);

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
      {/* Honeypot: hidden from humans, catnip for bots. */}
      <div className="hidden" aria-hidden="true">
        <Input
          label=""
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={values.website}
          onChange={(e) => setValue('website', e.target.value)}
        />
      </div>

      <div data-booking-field="name">
        <Input
          label="Full name"
          autoComplete="name"
          value={values.name}
          onChange={(e) => setValue('name', e.target.value)}
          error={errors.name}
        />
      </div>

      <div className={showPhone ? 'grid gap-5 sm:grid-cols-2' : undefined}>
        <div data-booking-field="email">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={values.email}
            onChange={(e) => setValue('email', e.target.value)}
            error={errors.email}
          />
        </div>
        {showPhone ? (
          <div data-booking-field="phone">
            <Input
              label="Phone"
              type="tel"
              autoComplete="tel"
              optional={phoneField === 'optional'}
              value={values.phone}
              onChange={(e) => setValue('phone', e.target.value)}
              error={errors.phone}
            />
          </div>
        ) : null}
      </div>

      {rows.map((row) => (
        <div key={row.map((q) => q.id).join('|')} className={row.length > 1 ? 'grid gap-5 sm:grid-cols-2' : undefined}>
          {row.map((q) => (
            <div key={q.id} data-booking-field={q.id}>
              <BookingQuestionField
                question={q}
                value={answers[q.id]}
                error={errors[q.id]}
                onChange={(v) => setAnswer(q.id, v)}
              />
            </div>
          ))}
        </div>
      ))}

      <div data-booking-field="notes">
        <Textarea
          label="Anything else we should know?"
          optional
          rows={4}
          value={values.notes}
          onChange={(e) => setValue('notes', e.target.value)}
          error={errors.notes}
        />
      </div>

      {/* Pinned to the bottom on a phone so the button stays in thumb reach. */}
      <div className="space-y-2 pt-2 max-md:sticky max-md:bottom-0 max-md:z-10 max-md:-mx-5 max-md:border-t max-md:border-border max-md:bg-card max-md:px-5 max-md:pb-[max(1rem,env(safe-area-inset-bottom))] max-md:pt-3">
        {formError ? (
          <p role="alert" className="text-body text-danger">
            {formError}
          </p>
        ) : null}
        <Button type="submit" loading={loading} className="w-full">
          Confirm booking
        </Button>
      </div>
    </form>
  );
}

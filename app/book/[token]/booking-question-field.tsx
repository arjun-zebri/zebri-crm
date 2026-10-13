/**
 * Renders one meeting-type question as the right control for its type.
 *
 * Short answers stay on one line in a text input, paragraphs get a textarea,
 * and anything with a fixed list becomes tappable pills rather than a dropdown.
 * Every control gets the same label, help text, optional tag and error, so a
 * custom question reads exactly like the built-in fields around it.
 *
 * @module app/book/[token]/booking-question-field
 */
'use client'

import { ChoiceGroup } from '@/components/ui/choice-group'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { AnswerValue, BookingQuestion } from '@/lib/booking/questions'

export interface BookingQuestionFieldProps {
  question: BookingQuestion;
  value: AnswerValue | undefined;
  /** Inline error for this question, from the form or the server. */
  error?: string | undefined;
  onChange: (value: AnswerValue) => void;
}

/** Types that can sit two to a row on sm and up. Paragraphs and choices never do. */
const PAIRABLE: ReadonlySet<BookingQuestion['type']> = new Set(['short_text', 'number', 'date']);

/**
 * Lay the questions out in rows: consecutive short questions share a row,
 * anything long or choice-based takes the full width. Order is preserved.
 *
 * @param questions - the meeting type's questions, in display order
 */
export function groupQuestionRows(questions: BookingQuestion[]): BookingQuestion[][] {
  const rows: BookingQuestion[][] = [];
  for (const q of questions) {
    const last = rows[rows.length - 1];
    if (PAIRABLE.has(q.type) && last && last.length === 1 && PAIRABLE.has(last[0]!.type)) {
      last.push(q);
    } else {
      rows.push([q]);
    }
  }
  return rows;
}

/** One question, rendered as the control its type calls for. */
export function BookingQuestionField({ question, value, error, onChange }: BookingQuestionFieldProps) {
  const optional = !question.required;
  const text = typeof value === 'string' ? value : '';
  const shared = { label: question.label, help: question.help, error, optional };

  switch (question.type) {
    case 'long_text':
      return (
        <Textarea
          {...shared}
          rows={3}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'date':
      return (
        <DatePicker
          {...shared}
          id={`booking-q-${question.id}`}
          value={text}
          placeholder="Pick a date"
          onChange={(v) => onChange(v)}
        />
      );
    case 'number':
      return (
        <Input
          {...shared}
          inputMode="numeric"
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'single_choice':
      return (
        <ChoiceGroup
          label={question.label}
          help={question.help}
          error={error}
          optional={optional}
          options={question.options ?? []}
          value={text === '' ? null : text}
          onChange={(v) => onChange(v)}
        />
      );
    case 'multi_choice':
      return (
        <ChoiceGroup
          mode="multiple"
          label={question.label}
          help={question.help}
          error={error}
          optional={optional}
          options={question.options ?? []}
          value={Array.isArray(value) ? value : []}
          onChange={(v) => onChange(v)}
        />
      );
    default:
      return (
        <Input
          {...shared}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

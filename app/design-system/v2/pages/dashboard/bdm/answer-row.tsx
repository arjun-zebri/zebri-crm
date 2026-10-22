'use client';

import { DateField } from '@/components/ui-v2/date-field';
import { Dropdown } from '@/components/ui-v2/dropdown';
import { Input } from '@/components/ui-v2/input';

import { answerText, type Answer, type Question } from '../questionnaires/questionnaire-data';

/**
 * One of the couple's answers as the celebrant sees it in the paperwork:
 * a ledger row (user ruling 2026-10-15, the look for form fields in the
 * app, as Settings has them), the question's name in grey on the left,
 * the answer beside it, editable in place, "Add …" while empty. A choice
 * is a dropdown here, not the couple's list of cards: the celebrant
 * knows the options, and forty answers have to fit on a screen. What the
 * Registry would refuse sits under the answer in red.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/answer-row
 */

export interface AnswerRowProps {
  question: Question;
  value: Answer | undefined;
  onChange: (a: Answer) => void;
  error?: string | undefined;
}

/** One answer. See {@link AnswerRowProps}. */
export function AnswerRow({ question: q, value, onChange, error }: AnswerRowProps) {
  const text = answerText(value);
  const help = q.help.trim() || undefined;
  if (q.type === 'date') return <DateField row label={q.label} help={help} value={text} onChange={onChange} error={error} />;
  if (q.type === 'dropdown' || q.type === 'single_choice' || q.type === 'yes_no') {
    const options = q.type === 'yes_no' ? ['Yes', 'No'] : q.options;
    return (
      <div>
        <Dropdown row label={q.label} options={options.map((o) => ({ value: o, label: o }))} value={text} onChange={onChange} />
        {/* Under the value column: the name column's 9.5rem and the row's 1rem gap. */}
        {error ? (
          <p role="alert" className="type-body text-danger sm:pl-[10.5rem]">
            {error}
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <Input
      row
      label={q.label}
      help={help}
      inputMode={q.type === 'number' ? 'numeric' : undefined}
      value={text}
      error={error}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

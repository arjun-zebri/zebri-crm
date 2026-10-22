'use client';

import { useState } from 'react';

import { formatDate } from '@/components/ui-v2/date-field';
import { GroupLabel } from '@/components/ui-v2/group-label';
import { TextLink } from '@/components/ui-v2/text-link';

import { answerText, type Answer, type Question } from '../questionnaires/questionnaire-data';

import { celebrantLabel } from './celebrant-labels';
import type { FormPart } from './couple-form-parts';

/**
 * A person's answers as the celebrant reads them: each part's answers
 * that are in, name over value in two columns, the names in the
 * celebrant's voice (`celebrant-labels.ts`) and without the part's name
 * again under its heading. A refused answer has its problem in red under
 * it; one that only looks wrong (`oddities.ts`) has a question in amber.
 * What is still to come is one line, "Still to come: Occupation, Date of
 * birth and 14 more", and "14 more" opens the whole list (user,
 * 2026-10-15: "and 15 more" hid which ones to chase).
 *
 * @module app/design-system/v2/pages/dashboard/bdm/answers-read
 */

export interface AnswersReadProps {
  parts: FormPart[];
  answers: Record<string, Answer>;
  problems: Record<string, string>;
  odd: Record<string, string>;
}

/** An answer as it reads back: a date in words. */
export const shown = (q: Question, a: Answer | undefined) => {
  const text = answerText(a).trim();
  return q.type === 'date' && text ? formatDate(text) : text;
};

/** A label under its part's heading, without the part's name again ("Parent 1, given names" reads "Given names"). */
const under = (label: string, part: string) =>
  label.startsWith(`${part}, `) ? `${label.charAt(part.length + 2).toUpperCase()}${label.slice(part.length + 3)}` : label;

/** "A, B and C": a list in words. */
const listed = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] ?? ''));

/** The read view. See {@link AnswersReadProps}. */
export function AnswersRead({ parts, answers, problems, odd }: AnswersReadProps) {
  const [all, setAll] = useState(false);
  const missing = parts.flatMap((p) => p.questions).filter((q) => q.required && !shown(q, answers[q.id]));
  const any = parts.some((p) => p.questions.some((q) => shown(q, answers[q.id])));
  const names = missing.map(celebrantLabel);
  const first = all ? names : names.slice(0, 3);
  const rest = names.length - first.length;
  return (
    <>
      {parts.map((part) => {
        const given = part.questions.filter((q) => shown(q, answers[q.id]));
        if (!given.length) return null;
        return (
          <div key={part.at} className="space-y-2">
            {parts.length > 1 ? <GroupLabel as="p">{part.label}</GroupLabel> : null}
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {given.map((q) => (
                <div key={q.id} className="min-w-0">
                  <dt className="type-body text-zebra-500">{under(celebrantLabel(q), part.label)}</dt>
                  <dd className="break-words type-body text-zebra-950">{shown(q, answers[q.id])}</dd>
                  {problems[q.id] ? (
                    <dd className="type-body text-danger">{problems[q.id]}</dd>
                  ) : odd[q.id] ? (
                    <dd className="type-body text-warning-ink">{odd[q.id]}</dd>
                  ) : null}
                </div>
              ))}
            </dl>
          </div>
        );
      })}
      {missing.length ? (
        <p className="type-body text-zebra-500">
          {any ? 'Still to come: ' : 'To come: '}
          {rest > 0 ? (
            <>
              {first.join(', ')} and{' '}
              <TextLink inheritSize onClick={() => setAll(true)}>
                {rest} more
              </TextLink>
            </>
          ) : (
            listed(first)
          )}
        </p>
      ) : null}
    </>
  );
}

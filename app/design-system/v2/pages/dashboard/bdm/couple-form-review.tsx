'use client';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { formatDate } from '@/components/ui-v2/date-field';

import { ToFixList, type ToFix } from '../questionnaires/client-view/to-fix';
import { answerText, type Answer, type Question } from '../questionnaires/questionnaire-data';

import type { FormPart } from './couple-form-parts';

/**
 * Check your answers, the couple's last page before they send (user,
 * 2026-10-15), as GOV.UK ends every form: each part's answers read back
 * under its heading, with Change beside it, since this becomes a legal
 * document and a misspelt surname is caught here or never. A missing
 * answer says Needed, one the Registry would refuse says why, both in
 * red; the list at the foot goes to the first. The foot itself, both of
 * them confirming and Send, is `couple-form-send.tsx`.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/couple-form-review
 */

export interface CoupleFormReviewProps {
  parts: FormPart[];
  answers: Record<string, Answer>;
  problems: Record<string, string>;
  toFix: ToFix[];
  /** Opens a part, at an answer when one is named. */
  onChange: (at: number, id?: string) => void;
  /** What closes the page: both confirm and Send, or what was sent (`couple-form-send.tsx`). */
  send: ReactNode;
}

/** An answer as it reads back: a date in words, picks joined. */
function shown(q: Question, a: Answer | undefined): string {
  const text = Array.isArray(a) ? a.join(', ') : answerText(a).trim();
  return q.type === 'date' && text ? formatDate(text) : text;
}

/** The check. See {@link CoupleFormReviewProps}. */
export function CoupleFormReview({
  parts,
  answers,
  problems,
  toFix,
  onChange,
  send,
}: CoupleFormReviewProps) {
  const at = (id: string) => parts.find((p) => p.questions.some((q) => q.id === id))?.at ?? 0;
  return (
    <div className="space-y-10 motion-safe:animate-fade-in">
      <div className="space-y-2">
        <h2 className="type-title text-zebra-950">Check your answers</h2>
        <p className="type-body text-zebra-600">
          Make sure each one matches your ID. You can change anything before you send it.
        </p>
      </div>
      {parts.map((part) => (
        <section key={part.at} aria-labelledby={`review-${part.at}`} className="space-y-3">
          <div className="flex items-baseline justify-between gap-4 border-b border-hairline pb-2">
            <h3 id={`review-${part.at}`} className="type-subheading text-zebra-950">
              {part.title}
            </h3>
            <Button
              variant="text"
              onClick={() => onChange(part.at)}
              aria-label={`Change ${part.title}`}
            >
              Change
            </Button>
          </div>
          {/* A part with nothing in it yet is one quiet line, not a column of red Needed. */}
          {part.questions.every((q) => !shown(q, answers[q.id])) ? (
            <p className="type-body text-zebra-500">Not started yet</p>
          ) : (
            <dl className="space-y-2">
              {part.questions.map((q) => {
                const value = shown(q, answers[q.id]);
                const problem = problems[q.id] ?? (q.required && !value ? 'Needed' : undefined);
                return (
                  <div
                    key={q.id}
                    className="grid gap-x-6 gap-y-0.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
                  >
                    <dt className="type-body text-zebra-500">{q.label}</dt>
                    <dd className="min-w-0 type-body">
                      {value ? (
                        <span className="break-words text-zebra-950">{value}</span>
                      ) : problem ? null : (
                        <span className="text-zebra-400">Not given</span>
                      )}
                      {problem ? <span className="block text-danger">{problem}</span> : null}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
        </section>
      ))}
      <div className="space-y-6 border-t border-hairline pt-6">
        <ToFixList items={toFix} onGoto={(id) => onChange(at(id), id)} />
        {send}
      </div>
    </div>
  );
}

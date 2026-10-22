'use client';

import { Fragment } from 'react';

import { Button } from '@/components/ui-v2/button';

import { QuestionField } from '../fields/question-field';
import type { Answer, Question } from '../questionnaire-data';

import { ToFixList, type ToFix } from './to-fix';

/**
 * Every question on one page, in order, sections as headings between
 * them, and Submit at the foot. Answers save as they are given, so a
 * client can leave and come back. A checked form (`toFix` given) holds
 * Submit until its list is empty, and each line of the list scrolls to
 * its question.
 *
 * @module app/design-system/v2/pages/dashboard/questionnaires/client-view/page-style
 */

export interface StyleProps {
  questions: Question[];
  answers: Record<string, Answer>;
  onAnswer: (question: string, answer: Answer) => void;
  onSubmit?: (() => void) | undefined;
  /** The steps style's first question, 0-based: where a client left off. */
  startAt?: number | undefined;
  /** What is wrong with an answer, by question id, shown under it. */
  problems?: Record<string, string> | undefined;
  /**
   * A checked form: every answer still to give or fix. Given (even
   * empty), Submit waits until it is empty and the list shows at Submit.
   */
  toFix?: ToFix[] | undefined;
  /** Dates typed that could not be read, by question id, so they are kept. */
  drafts?: Record<string, string> | undefined;
  onDraft?: ((question: string, text: string) => void) | undefined;
  /** Boxed fields on a six-column grid, a question's `span` setting its share of a row (`QuestionField` `boxed`). */
  boxed?: boolean | undefined;
}

/** A question's cell on a boxed page's six-column grid: a third, a half, or the whole row; whole on phones unless `phoneHalf`. */
function cell(q: Question, i: number): string {
  if (q.type === 'section') return i ? 'col-span-6 pt-6' : 'col-span-6';
  const phone = q.phoneHalf ? 'col-span-3' : 'col-span-6';
  return q.span === 'third' ? `${phone} sm:col-span-2` : q.span === 'half' ? `${phone} sm:col-span-3` : phone;
}

/** Where a question sits on the page, for the to-fix list to scroll to. */
export const questionAnchor = (id: string) => `question-${id.replace(/[^A-Za-z0-9_-]/g, '-')}`;

/** One page. See {@link StyleProps}. */
export function PageStyle({ questions, answers, onAnswer, onSubmit, problems, toFix, drafts, onDraft, boxed = false }: StyleProps) {
  const held = Boolean(toFix?.length);
  return (
    // Boxed, related answers share a row (Suburb, State, Postcode) and
    // each field keeps 20px below it, room for its hint (user, 2026-10-15).
    <div className={boxed ? 'grid grid-cols-6 gap-x-3 gap-y-5' : 'space-y-7'}>
      {questions.map((q, i) => (
        <Fragment key={q.id}>
          <div id={questionAnchor(q.id)} className={boxed ? `scroll-mt-24 ${cell(q, i)}` : 'scroll-mt-6'}>
            <QuestionField
              question={q}
              value={answers[q.id]}
              onChange={(a) => onAnswer(q.id, a)}
              error={problems?.[q.id]}
              draft={drafts?.[q.id]}
              onInvalid={onDraft ? (text) => onDraft(q.id, text) : undefined}
              boxed={boxed}
            />
          </div>
          {/* A row of its own, so a link under the last of three boxes does not hang in its column. */}
          {boxed && q.reveal ? <Reveal reveal={q.reveal} onAnswer={onAnswer} /> : null}
        </Fragment>
      ))}
      {onSubmit ? (
        <div className={`space-y-4 ${boxed ? 'col-span-6 pt-4' : 'pt-2'}`}>
          {toFix ? <ToFixList items={toFix} onGoto={(id) => document.getElementById(questionAnchor(id))?.scrollIntoView({ behavior: 'smooth', block: 'center' })} /> : null}
          <Button disabled={held} onClick={onSubmit}>
            Submit
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** A question's `reveal`: a quiet link under it that sets the answers it names, opening a branch few take. */
function Reveal({ reveal, onAnswer }: { reveal: NonNullable<Question['reveal']>; onAnswer: StyleProps['onAnswer'] }) {
  return (
    <div className="col-span-6 -mt-3">
      <Button variant="text" onClick={() => Object.entries(reveal.set).forEach(([id, a]) => onAnswer(id, a))}>
        {reveal.label}
      </Button>
    </div>
  );
}

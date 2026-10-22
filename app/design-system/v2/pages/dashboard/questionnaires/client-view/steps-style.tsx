'use client';

import { useState, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui-v2/button';

import { QuestionField } from '../fields/question-field';
import { TYPE_META, answerText } from '../questionnaire-data';

import type { StyleProps } from './page-style';
import { ToFixList } from './to-fix';

/**
 * One question at a time: the section it sits in above it, how far
 * along the client is ("3 of 12"), then Back and Next, with Submit on the
 * last. Sections are not steps of their own: each heads the questions
 * under it. Required questions do not block Next: the client can come
 * back to them, and Submit is where Zebri would ask. Enter in a typed
 * answer goes to the next question, as Next does.
 *
 * A checked form (`toFix` given) counts what is left instead ("12
 * answers to go", on the same basis as the celebrant's own count), since
 * its follow-up questions open as answers call for them and a "3 of 45"
 * would grow under the couple. Its Submit waits until nothing is left to
 * give or fix, with the list above it, each line going to its question.
 *
 * @module app/design-system/v2/pages/dashboard/questionnaires/client-view/steps-style
 */

/** One at a time. See {@link StyleProps}. */
export function StepsStyle({ questions, answers, onAnswer, onSubmit, startAt = 0, problems, toFix, drafts, onDraft }: StyleProps) {
  const steps = questions.flatMap((q, i) => {
    if (!TYPE_META[q.type].isInput) return [];
    const section = questions.slice(0, i).reverse().find((x) => x.type === 'section');
    return [{ q, section }];
  });
  const [at, setAt] = useState(startAt);
  const i = Math.min(at, Math.max(steps.length - 1, 0));
  const step = steps[i];
  if (!step) return <p className="type-body text-zebra-500">No questions yet.</p>;
  const last = i === steps.length - 1;
  const left = steps.filter(({ q }) => q.required && answerText(answers[q.id]).trim() === '').length;
  const goto = (id: string) => {
    const to = steps.findIndex(({ q }) => q.id === id);
    if (to >= 0) setAt(to);
  };
  // Enter in a typed answer moves on; not in a text box (a new line), a list that is open, or on the last question.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const t = e.target;
    if (e.key !== 'Enter' || last || e.nativeEvent.isComposing || !(t instanceof HTMLInputElement)) return;
    if (t.getAttribute('role') === 'combobox' || t.getAttribute('aria-expanded') === 'true') return;
    e.preventDefault();
    setAt(i + 1);
  };
  return (
    <div className="space-y-6" onKeyDown={onKeyDown}>
      <p className="type-body text-zebra-500">
        {step.section?.label.trim() ? `${step.section.label.trim()} · ` : ''}
        {toFix ? (left ? `${left} ${left === 1 ? 'answer' : 'answers'} to go` : 'All answered') : `${i + 1} of ${steps.length}`}
      </p>
      {/* Keyed, so a step starts fresh rather than keeping the last one's typing. */}
      <QuestionField
        key={step.q.id}
        question={step.q}
        value={answers[step.q.id]}
        onChange={(a) => onAnswer(step.q.id, a)}
        error={problems?.[step.q.id]}
        draft={drafts?.[step.q.id]}
        onInvalid={onDraft ? (text) => onDraft(step.q.id, text) : undefined}
      />
      {last && onSubmit && toFix ? <ToFixList items={toFix} onGoto={goto} /> : null}
      <div className="flex items-center gap-3 pt-2">
        {i > 0 ? (
          <Button variant="plain" onClick={() => setAt(i - 1)}>
            Back
          </Button>
        ) : null}
        {!last ? (
          <Button onClick={() => setAt(i + 1)}>Next</Button>
        ) : onSubmit ? (
          <Button disabled={Boolean(toFix?.length)} onClick={onSubmit}>
            Submit
          </Button>
        ) : null}
      </div>
    </div>
  );
}

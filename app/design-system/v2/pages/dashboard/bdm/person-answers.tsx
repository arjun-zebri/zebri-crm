'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { GroupLabel } from '@/components/ui-v2/group-label';
import type { ZebriIcon } from '@/components/ui-v2/icons';

import type { Answer } from '../questionnaires/questionnaire-data';

import { AnswerRow } from './answer-row';
import { AnswersRead, shown } from './answers-read';
import { celebrantLabel } from './celebrant-labels';
import type { FormPart } from './couple-form-parts';
import { PaperCard } from './paper-card';

/**
 * One person's answers in the paperwork dialog, on a card of their own
 * (user, 2026-10-15: forty editable rows of "Add …" did not feel
 * premium), on the shared `PaperCard`. The head says how far they are,
 * as a count and a short bar, or Complete; the strip of bars that sat over the cards said the same
 * thing twice and went. Anything that looks wrong is counted there too
 * ("1 to look at"). Read first (`answers-read.tsx`); Fill in for them
 * (or Edit, once some are in) turns the card into ledger rows to type
 * into, and Done turns it back. Locked once lodged, when it only reads.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/person-answers
 */

export interface PersonAnswersProps {
  /** Whose: a first name, or "Together". */
  name: string;
  /** Their parts: Details, Parent 1, Parent 2, ID. */
  parts: FormPart[];
  answers: Record<string, Answer>;
  problems: Record<string, string>;
  /** Answers that look wrong but BDM would take (`oddities.ts`). */
  odd: Record<string, string>;
  onAnswer: (id: string, a: Answer) => void;
  locked: boolean;
  /** A glyph at the card's head in place of initials: rings for the two of
   *  them, a person for a partner with no name yet ("Arjun's partner" is not "AP"). */
  glyph?: ZebriIcon | undefined;
}

/** One person's card. See {@link PersonAnswersProps}. */
export function PersonAnswers({
  name,
  parts,
  answers,
  problems,
  odd,
  onAnswer,
  locked,
  glyph,
}: PersonAnswersProps) {
  const [editing, setEditing] = useState(false);
  const all = parts.flatMap((p) => p.questions);
  const needed = all.filter((q) => q.required);
  const done = needed.filter((q) => shown(q, answers[q.id])).length;
  const any = all.some((q) => shown(q, answers[q.id]));
  const flagged = all.filter((q) => problems[q.id] || odd[q.id]).length;
  return (
    <PaperCard
      title={name}
      glyph={glyph}
      done={done}
      of={needed.length}
      flagged={flagged}
      action={
        locked ? null : (
          <Button variant="text" onClick={() => setEditing((e) => !e)}>
            {editing ? 'Done' : any ? 'Edit' : 'Fill in for them'}
          </Button>
        )
      }
    >
      {editing ? (
        parts.map((part) => (
          <div key={part.at} className="space-y-1">
            {parts.length > 1 ? <GroupLabel as="p">{part.label}</GroupLabel> : null}
            <div className="space-y-0.5">
              {part.questions.map((q) => (
                <AnswerRow
                  key={q.id}
                  question={{ ...q, label: celebrantLabel(q) }}
                  value={answers[q.id]}
                  onChange={(a) => onAnswer(q.id, a)}
                  error={problems[q.id]}
                />
              ))}
            </div>
          </div>
        ))
      ) : (
        <AnswersRead parts={parts} answers={answers} problems={problems} odd={odd} />
      )}
    </PaperCard>
  );
}

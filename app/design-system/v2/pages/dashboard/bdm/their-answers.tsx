'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { EmptyState } from '@/components/ui-v2/empty-state';
import { BdmIcon, RingsIcon, UserIcon } from '@/components/ui-v2/icons';

import { answerText } from '../questionnaires/questionnaire-data';

import type { Paperwork } from './bdm-data';
import { answer, coupleChecks } from './couple-checks';
import { formParts, type FormPart } from './couple-form-parts';
import { firstName, formQuestions, prefill } from './noim-questions';
import { oddities } from './oddities';
import { PersonAnswers } from './person-answers';

/**
 * The couple's answers in the paperwork dialog, rebuilt three times on
 * 2026-10-15 (the user: icon-led fields a row apart were "terrible";
 * forty editable rows of "Add …" did not "feel premium at all"; then a
 * strip of bars over the cards said each count twice). A card a person
 * (`person-answers.tsx`), each with its own count and bar, then one for
 * the two of them, "Together". Before it is sent there is nothing to
 * read: one quiet empty state in place of three cards of "Nothing yet",
 * with Fill in for them for a celebrant taking the answers at a meeting.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/their-answers
 */

/** The three cards: each person, then the two of them. */
const WHO = ['p1', 'p2', 'related'] as const;
type Who = (typeof WHO)[number];

/** The couple's answers. `initial` scrolls to one person, when an issue sent the celebrant here. */
export function TheirAnswers({ paper: p, locked = false, initial = null }: { paper: Paperwork; locked?: boolean; initial?: string | null }) {
  const [filling, setFilling] = useState(false);
  const { problems } = coupleChecks(p);
  const odd = oddities(p);
  const parts = formParts(p, formQuestions(p), problems);
  const name = (w: Who) => (w === 'p1' ? firstName(p, 0) : w === 'p2' ? firstName(p, 1) : 'Together');
  const named = (w: Who) => {
    const i = w === 'p1' ? 0 : 1;
    return Boolean(p.names[i]?.trim() || answerText(p.answers[`p${i + 1}.givenName`]).trim());
  };
  const mine = (w: Who): FormPart[] =>
    parts.filter((part) => part.questions.some((q) => (w === 'related' ? !/^p[12]\./.test(q.id) : q.id.startsWith(`${w}.`))));
  useEffect(() => {
    if (initial) document.getElementById(`answers-${initial}`)?.scrollIntoView({ block: 'start' });
  }, [initial]);
  // Only what the client already gave (their names) is in: once anyone has typed an answer, it shows.
  const given = prefill(p.names);
  const untouched = Object.entries(p.answers).every(([id, a]) => !answerText(a).trim() || answerText(given[id]) === answerText(a));
  if (p.stage === 'draft' && untouched && !filling)
    return (
      <EmptyState
        compact
        icon={BdmIcon}
        title="Nothing to read yet"
        body="Their answers show here as they fill them in. Taking them at a meeting instead? Fill them in yourself."
        action={
          <Button variant="secondary" onClick={() => setFilling(true)}>
            Fill in for them
          </Button>
        }
      />
    );
  return (
    <div className="space-y-4">
      {WHO.map((w) => (
        <div key={w} id={`answers-${w}`} className="scroll-mt-4">
          <PersonAnswers
            name={name(w)}
            glyph={w === 'related' ? RingsIcon : named(w) ? undefined : UserIcon}
            parts={mine(w)}
            answers={p.answers}
            problems={problems}
            odd={odd}
            onAnswer={(id, a) => answer(p, id, a)}
            locked={locked}
          />
        </div>
      ))}
    </div>
  );
}

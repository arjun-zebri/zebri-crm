'use client';

import { Button } from '@/components/ui-v2/button';

/**
 * What a checked form still waits on before it can be sent, at its
 * Submit: one line on why Submit is held, then each answer to give or
 * fix, each a link that goes to it. Only for a form that checks its
 * answers (the BDM form, where an answer the Registry would refuse is
 * the couple's to fix, not their celebrant's later). A free
 * questionnaire never shows it.
 *
 * @module app/design-system/v2/pages/dashboard/questionnaires/client-view/to-fix
 */

/** One answer a checked form waits on. */
export interface ToFix {
  /** The question's id. */
  id: string;
  /** The question, as the list names it: "Date of birth". */
  label: string;
  /** What is wrong: "Needed", "Has to be in the past". */
  problem: string;
}

/** What `coupleChecks` calls an answer not given yet. */
const BLANK = 'Needed';

/**
 * The list. Renders nothing once everything is in. Answers to fix (a
 * date that is not real, a name BDM would refuse) are listed one by one,
 * but blank ones are a single line with a link to the first: on a fresh
 * form, listing every blank answer repeats the whole form under itself.
 */
export function ToFixList({ items, onGoto }: { items: ToFix[]; onGoto: (id: string) => void }) {
  if (!items.length) return null;
  const blank = items.filter((i) => i.problem === BLANK);
  const wrong = items.filter((i) => i.problem !== BLANK);
  return (
    <div role="status" className="space-y-2">
      {blank.length ? (
        <p className="flex flex-wrap items-baseline gap-x-2 type-body text-warning-ink">
          <span>
            {blank.length} {blank.length === 1 ? 'answer' : 'answers'} still to give before you can send this.
          </span>
          <Button variant="text" onClick={() => onGoto(blank[0]!.id)}>
            Go to the first
          </Button>
        </p>
      ) : null}
      {wrong.length ? (
        <>
          <p className="type-body text-warning-ink">
            {wrong.length} {wrong.length === 1 ? 'answer' : 'answers'} to fix:
          </p>
          <ul className="space-y-0.5">
            {wrong.map((item) => (
              <li key={item.id} className="flex flex-wrap items-baseline gap-x-2">
                <Button variant="text" onClick={() => onGoto(item.id)}>
                  {item.label}
                </Button>
                <span className="type-body text-zebra-500">{item.problem}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

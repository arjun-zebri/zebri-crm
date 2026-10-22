'use client';

import { useRef, useState } from 'react';

import { dayMonth } from '../payments/dates';
import { answerText, type Answer } from '../questionnaires/questionnaire-data';

import { today } from './bdm-data';
import { demoAnswers } from './bdm-seeds';
import { readCoupleForm, sendBack, type CoupleFormHandoff } from './couple-form-link';
import { withLinked } from './noim-questions';

/**
 * The couple's page's state: the form handed over from the paperwork
 * (`couple-form-link.ts`), every answer saved as it is given and sent
 * back to the paperwork's tab, and what was last sent, so Check your
 * answers can say Sent, or that answers changed since (user, 2026-10-15:
 * they may update after sending, until the celebrant has checked it).
 * Sending works from the preview too, as the couple would, so the
 * paperwork can be seen to receive it.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/use-couple-form
 */

/** Stages after which the couple's answers are with the celebrant already. */
const BACK = new Set(['returned', 'checked', 'lodged', 'registered']);
/** Stages after which the celebrant has checked the notice, and the couple can no longer change it. */
const LOCKED = new Set(['checked', 'lodged', 'registered']);

/** The couple's form for one client. */
export function useCoupleForm(client: string) {
  const [form, setForm] = useState<CoupleFormHandoff | null>(() => readCoupleForm(client));
  const [saved, setSaved] = useState(false);
  // The answers as last sent, to tell Sent from changed since.
  const [sent, setSent] = useState<{ answers: string; on: string } | null>(() =>
    form && BACK.has(form.paper.stage) ? { answers: JSON.stringify(form.paper.answers), on: form.paper.returnedOn ? dayMonth(form.paper.returnedOn) : '' } : null,
  );
  // The answers as of the last change, not this render: a step that sets
  // several at once (a link, the ID read) would otherwise write each over
  // a copy without the one before.
  const latest = useRef(form?.paper.answers ?? {});
  const apply = (changes: Record<string, Answer>) => {
    latest.current = { ...latest.current, ...changes };
    setForm((f) => (f ? { ...f, paper: { ...f.paper, answers: { ...f.paper.answers, ...changes } } } : f));
    setSaved(true);
    Object.entries(changes).forEach(([id, answer]) => sendBack({ client, kind: 'answer', id, answer, at: Date.now() }));
  };
  const answer = (id: string, a: Answer) => apply(withLinked(id, a, latest.current));
  /** Demo only: every blank answer filled in (what they typed stays), the IDs as if photographed. */
  const fill = () => {
    if (!form) return;
    const blank = Object.entries(demoAnswers(form.paper.names)).filter(([id]) => answerText(latest.current[id]).trim() === '');
    apply({ ...Object.fromEntries(blank), 'p1.idPhoto': 'read', 'p2.idPhoto': 'read' });
  };
  const send = () => {
    sendBack({ client, kind: 'submit', at: Date.now() });
    setSent({ answers: JSON.stringify(latest.current), on: today() });
  };
  const answers = form?.paper.answers ?? {};
  const status: 'new' | 'sent' | 'changed' = !sent ? 'new' : sent.answers === JSON.stringify(answers) ? 'sent' : 'changed';
  return { form, answer, fill, send, saved, status, sentOn: sent?.on, locked: Boolean(form && LOCKED.has(form.paper.stage)) };
}

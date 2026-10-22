'use client';

import { useState } from 'react';

import { BrandScope, Letterhead } from '../../payments/modal/letterhead';
import type { Answer, Template } from '../questionnaire-data';

import { PageStyle } from './page-style';
import { PagedStyle, type PagedOptions } from './paged-style';
import { StepsStyle } from './steps-style';
import type { ToFix } from './to-fix';

/** What a checked form says of a date it could not read. */
const UNREADABLE = 'Not a real date. Try one like 1 Jul 1994';

/**
 * A questionnaire as the client sees it, in the MC's name: the business
 * at the top, the title and the line to the client, then the questions,
 * either all on one page or one at a time (the template's style). The
 * builder shows it live beside the questions as they are written (try
 * it: answers there are thrown away), and a client's copy shows it with
 * their answers, which the MC can fill in for them. A fixed form that
 * checks its answers (the BDM form) passes `problems` and `toFix`: each
 * problem shows under its answer, and Submit waits on the list. A date
 * typed that cannot be read is kept here as a draft (never as the
 * answer, which stays a real date or nothing) and joins the list.
 *
 * @module app/design-system/v2/pages/dashboard/questionnaires/client-view/client-view
 */

export interface ClientViewProps {
  template: Template;
  answers: Record<string, Answer>;
  onAnswer: (question: string, answer: Answer) => void;
  /** The last step's or the page's foot button; none for the MC's copy. */
  onSubmit?: (() => void) | undefined;
  /** In the steps style, the question to open on, 0-based. */
  startAt?: number | undefined;
  /** What is wrong with an answer, by question id. */
  problems?: Record<string, string> | undefined;
  /** A checked form's answers still to give or fix; given, Submit waits until it is empty. */
  toFix?: ToFix[] | undefined;
  /** Boxed fields, names over them and hints shown, related answers sharing a row (the couple's BDM form). */
  boxed?: boolean | undefined;
  /** False leaves out the letterhead, title and intro, for a page that draws its own (`couple-form-page.tsx`). */
  header?: boolean | undefined;
  /** A section a page, with Back and Next (`PagedStyle`), for a long form; its options to hold the part or set the eyebrow and intro. */
  paged?: boolean | PagedOptions | undefined;
}

/** The client's view. See {@link ClientViewProps}. */
export function ClientView({ template: t, answers, onAnswer, onSubmit, startAt, problems, toFix, boxed = false, header = true, paged = false }: ClientViewProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const onDraft = (id: string, text: string) => setDrafts((d) => ({ ...d, [id]: text }));
  const order = (id: string) => t.questions.findIndex((q) => q.id === id);
  const unread = Object.keys(drafts).filter((id) => drafts[id]?.trim());
  // An unreadable date outranks whatever else is said of that answer ("Needed").
  const shown = toFix ? { ...problems, ...Object.fromEntries(unread.map((id) => [id, UNREADABLE])) } : problems;
  const list = toFix
    ? [
        ...toFix.filter((x) => !unread.includes(x.id)),
        ...unread.flatMap((id) => {
          const q = t.questions.find((x) => x.id === id);
          // The caller's label when it has one: it says whose answer it is.
          return q ? [{ id, label: toFix.find((x) => x.id === id)?.label ?? q.label, problem: UNREADABLE }] : [];
        }),
      ].sort((a, b) => order(a.id) - order(b.id))
    : undefined;
  const style = { questions: t.questions, answers, onAnswer, onSubmit, problems: shown, toFix: list, drafts, onDraft: toFix ? onDraft : undefined, boxed };
  return (
    // The MC's brand, as on every page their client sees: their letterhead, and the title in their heading face.
    <BrandScope>
    <div className="mx-auto w-full max-w-xl space-y-8">
      {header ? (
        <header className="space-y-3">
          <Letterhead className="type-label" />
          <h2 className="font-[family-name:var(--b-heading)] type-title text-zebra-950">{t.title.trim() || 'Your questionnaire'}</h2>
          {t.intro.trim() ? <p className="whitespace-pre-line type-body text-zebra-600">{t.intro}</p> : null}
        </header>
      ) : null}
      {paged ? (
        <PagedStyle {...style} {...(paged === true ? {} : paged)} />
      ) : t.style === 'steps' ? (
        <StepsStyle {...style} startAt={startAt} />
      ) : (
        <PageStyle {...style} />
      )}
    </div>
    </BrandScope>
  );
}

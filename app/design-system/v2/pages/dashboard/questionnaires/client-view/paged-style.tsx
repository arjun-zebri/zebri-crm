'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ProgressBar } from '@/components/ui-v2/progress-bar';

import type { Question } from '../questionnaire-data';

import { PageStyle, questionAnchor, type StyleProps } from './page-style';
import { ToFixList } from './to-fix';

/**
 * A long form a section at a time (user, 2026-10-15: the couple's forty
 * marriage questions on one page were overwhelming): each section is a
 * page, its heading the page's title under a quiet eyebrow ("Your
 * marriage details · Part 2 of 9"), Back and Next under it, and on the
 * last page what is still to give and Submit. A line of the to-fix list
 * turns to that answer's page and scrolls to it. Answers save as they
 * are given, so Next never waits on a page being complete; Submit is
 * where the form insists.
 *
 * The part on screen can be held by the caller (`part`, `onPart`), so a
 * page that draws its own progress (the couple's, in its sticky bar)
 * keeps it in step and passes `progress={false}`: one measure of how far
 * along, not two. On phones Back and Next stick to the foot of the
 * screen, where a thumb is, over a hairline; they assume the 24px card
 * padding the couple's page gives phones.
 *
 * @module app/design-system/v2/pages/dashboard/questionnaires/client-view/paged-style
 */

/**
 * Back and Next on a phone: at the end of the page, in its flow, the
 * buttons sharing the width as a phone's own do, with room under them
 * since the scroll has no bottom padding there (user, 2026-10-15: a
 * strip stuck to the foot was "taking up the screen").
 */
export const PHONE_BAR = 'max-sm:*:flex-1 max-sm:pb-8';

/** The questions split at each section heading; anything before the first heading is its own page. */
export function pagesOf(questions: Question[]): Question[][] {
  const pages: Question[][] = [];
  questions.forEach((q) => {
    const last = pages[pages.length - 1];
    if (!last || (q.type === 'section' && last.length)) pages.push([q]);
    else last.push(q);
  });
  return pages;
}

/** How a paged form is told, beyond {@link StyleProps}. */
export interface PagedOptions {
  /** The part on screen, 0-based, when the caller holds it. */
  part?: number | undefined;
  /** Called with the part to show. */
  onPart?: ((part: number) => void) | undefined;
  /** The line over each part's title; "Part 2 of 9" by default. */
  eyebrow?: ((part: number, total: number) => string) | undefined;
  /** What opens part 1 only, over its title: the form's note to whoever fills it in. */
  intro?: ReactNode;
  /** False leaves out the progress bar, for a caller that draws its own. */
  progress?: boolean | undefined;
  /** In place of Submit on the last page, a step of the caller's own (Check your answers); the to-fix list is then theirs to show. */
  finish?: { label: string; onClick: () => void } | undefined;
  /** Gives part 1 a Back, to what came before the form (a welcome page). */
  before?: (() => void) | undefined;
  /**
   * Draws a page its own way (the couple's ID, as a photo to take): given
   * the page's heading and its questions, a node in place of the fields,
   * or undefined to draw them as usual.
   */
  render?: ((head: Question | undefined, body: Question[]) => ReactNode | undefined) | undefined;
}

/** The paged form. Takes {@link StyleProps} and {@link PagedOptions}. */
export function PagedStyle({ onSubmit, toFix, part, onPart, eyebrow, intro, progress = true, finish, before, render, ...rest }: StyleProps & PagedOptions) {
  const pages = pagesOf(rest.questions);
  const [own, setOwn] = useState(0);
  const at = Math.min(part ?? own, pages.length - 1);
  const setAt = (to: number) => {
    setOwn(to);
    onPart?.(to);
  };
  // An answer the to-fix list asked for, scrolled to once its page is on screen.
  const [seek, setSeek] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const page = pages[at] ?? [];
  // The section heading becomes the page's title; the questions under it fill the page.
  const head = page[0]?.type === 'section' ? page[0] : undefined;
  const body = head ? page.slice(1) : page;
  const last = at >= pages.length - 1;
  const go = (to: number) => {
    setAt(to);
    // A new page starts at its top, not wherever the last one was scrolled to.
    top.current?.scrollIntoView({ block: 'start' });
  };
  useEffect(() => {
    if (!seek) return;
    document.getElementById(questionAnchor(seek))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [seek, at]);
  const goto = (id: string) => {
    const to = pages.findIndex((p) => p.some((q) => q.id === id));
    if (to >= 0) setAt(to);
    setSeek(id);
  };
  return (
    <div ref={top} className="scroll-mt-24 space-y-8">
      {progress ? <ProgressBar label={`Part ${at + 1} of ${pages.length}`} value={at + 1} max={pages.length} /> : null}
      {/* Keyed by page, so each opens fresh and fades in, the v2 panel swap. */}
      <div key={at} className="space-y-8 motion-safe:animate-fade-in">
        {at === 0 && intro ? <div className="space-y-2 border-b border-hairline pb-8">{intro}</div> : null}
        <div className="space-y-1">
          <p className="type-body text-zebra-500">{eyebrow ? eyebrow(at, pages.length) : `Part ${at + 1} of ${pages.length}`}</p>
          {head ? <h2 className="type-title text-zebra-950">{head.label}</h2> : null}
          {head?.help.trim() ? <p className="pt-1 type-body text-zebra-600">{head.help}</p> : null}
        </div>
        {render?.(head, body) ?? <PageStyle {...rest} questions={body} />}
      </div>
      {last && toFix && !finish ? <ToFixList items={toFix} onGoto={goto} /> : null}
      <div className={`flex items-center justify-end gap-3 pt-2 ${PHONE_BAR}`}>
        {at > 0 || before ? (
          <Button variant="secondary" onClick={() => (at > 0 ? go(at - 1) : before?.())}>
            Back
          </Button>
        ) : null}
        {!last ? (
          <Button onClick={() => go(at + 1)}>Next</Button>
        ) : finish ? (
          <Button onClick={finish.onClick}>{finish.label}</Button>
        ) : onSubmit ? (
          <Button disabled={Boolean(toFix?.length)} onClick={onSubmit}>
            Submit
          </Button>
        ) : null}
      </div>
    </div>
  );
}


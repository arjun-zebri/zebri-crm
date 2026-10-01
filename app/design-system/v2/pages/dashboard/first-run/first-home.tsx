'use client';

import { useAutoAnimate } from '@formkit/auto-animate/react';
import { Blocks, CreditCard, Heart, UserPlus, type LucideIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { Badge } from '@/components/ui-v2/badge';
import { Panel } from '@/components/ui-v2/panel';

import { AskZebri } from '../ask-zebri';
import type { QuickStartId } from '../briefing';
import { ClientAvatars } from '../clients/client-parts';
import type { CountTarget } from '../up-next';
import { Count } from '../up-next';
import { UpNextRow } from '../up-next-row';

import type { Act, Headline, HomeRow, Look } from './home-rows';
import { TypedLine, typingTime } from './typed-line';

/**
 * A new account's Home: the real Home's column (greeting and the line
 * under it, Ask Zebri, Up next and its counts), filled from the new
 * account instead of the demo business. Ask Zebri and the counts join
 * once setup is done; until then Up next is the whole page. The first-run guide is not a
 * layer on top: its steps are Up next rows (see `home-rows.ts`), with a
 * button only on the MC's own to-dos.
 *
 * While the test client replies, the line under the greeting types out
 * each reply as it lands (`TypedLine`) and Up next steps aside, so the
 * page is one moving line rather than a box rewriting its text. When
 * there is a move again, Up next comes back once the line has finished
 * typing, sharpening in from slightly small (`swap-in`) with its button.
 * When setup ends (after the booking celebration), the page opens up in
 * order rather than all at once: the new greeting and line, then Ask
 * Zebri as the column eases up, then Up next, then the counts.
 * The replies also land in the bell, top right.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/first-home
 */

export interface FirstHomeProps {
  heading: 'h1' | 'h2';
  greeting: string;
  headline: Headline | null;
  /**
   * Ask Zebri, its quick starts and the counts: left out until setup is
   * done, so during setup the to-do in Up next is the only thing on the page.
   */
  ask: boolean;
  /**
   * The quick starts under Ask Zebri, and whether it scopes by client:
   * only what the account can do yet (none, and no scope, before its
   * first real client).
   */
  quickStarts: QuickStartId[];
  scoped: boolean;
  rows: HomeRow[];
  counts: { enquiries: number; outstanding: number; unsigned: number };
  onAct: (act: Act) => void;
  onLook: (look: Look) => void;
  onQuickStart: (id: QuickStartId) => void;
  onCount: (target: CountTarget) => void;
}

// Settles in once on load, each block a beat after the one above, as Home does.
const RISE = 'motion-safe:animate-rise-in';
const DELAY = ['', '[animation-delay:60ms]', '[animation-delay:120ms]'];

const ICON: Record<'tools' | 'add' | 'plan' | 'event', { icon: LucideIcon; tint: string }> = {
  tools: { icon: Blocks, tint: 'bg-zebra-100 text-zebra-700' },
  add: { icon: UserPlus, tint: 'bg-zebra-100 text-zebra-700' },
  plan: { icon: CreditCard, tint: 'bg-zebra-100 text-zebra-700' },
  event: { icon: Heart, tint: 'bg-grass-100 text-grass-800' },
};

function Lead({ lead }: { lead: HomeRow['lead'] }) {
  // Two overlapping circles for a couple, one per person, as on Clients.
  if (typeof lead === 'object') return <ClientAvatars client={lead} />;
  const { icon: Icon, tint } = ICON[lead];
  return (
    <span className={`flex size-8 shrink-0 items-center justify-center rounded-pill ${tint}`}>
      <Icon aria-hidden="true" strokeWidth={1.5} className="size-4" />
    </span>
  );
}

function Trail({ row }: { row: HomeRow }) {
  const parts: ReactNode[] = [];
  if (row.trail && 'badge' in row.trail)
    parts.push(
      <Badge key="badge" tone={row.trail.brand ? 'brand' : undefined}>
        {row.trail.badge}
      </Badge>,
    );
  if (row.trail && 'time' in row.trail)
    parts.push(
      <span key="time" className="type-body text-zebra-400">
        {row.trail.time}
      </span>,
    );
  return parts.length ? <span className="flex items-center gap-2">{parts}</span> : null;
}

/** The Home column. See {@link FirstHomeProps}. */
export function FirstHome({
  heading: Heading,
  greeting,
  headline,
  ask,
  quickStarts,
  scoped,
  rows,
  counts,
  onAct,
  onLook,
  onQuickStart,
  onCount,
}: FirstHomeProps) {
  // Rows arriving and leaving (a to-do done, a reply landing) glide rather than jump.
  const [list] = useAutoAnimate<HTMLUListElement>({
    duration: 280,
    easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
  });
  // Up next leaves while there is nothing to do, and returns only once the
  // live line has typed out, so the reply is read before the next move.
  const [shown, setShown] = useState(rows.length > 0);
  const [returned, setReturned] = useState(false);
  const late = headline?.live ? typingTime(headline.text) : 0;
  // When setup ends, Home opens up one piece at a time, not all at once:
  // the new line types, then Ask Zebri rises (the column easing up to
  // make room), then Up next, then the counts.
  const [opened, setOpened] = useState(ask);
  const [unfolding, setUnfolding] = useState(false);
  useEffect(() => {
    if (!ask || opened) return;
    const t = window.setTimeout(() => {
      setOpened(true);
      setUnfolding(true);
    }, late + 200);
    return () => window.clearTimeout(t);
  }, [ask, opened, late]);
  const wait = late + (ask ? 1000 : 350);
  useEffect(() => {
    const want = rows.length > 0;
    if (want === shown) return;
    const t = window.setTimeout(() => {
      setShown(want);
      if (want) setReturned(true);
    }, want ? wait : 0);
    return () => window.clearTimeout(t);
  }, [rows.length, shown, wait]);
  return (
    // During setup the page is only the greeting and Up next, so it sits
    // lower, about the middle of the screen; with Ask Zebri it starts
    // where the real Home does.
    <div
      className={`mx-auto w-full max-w-3xl space-y-5 px-4 pb-24 pt-6 transition-[padding] duration-700 ease-out motion-reduce:transition-none md:px-8 ${opened ? 'md:pt-[16vh]' : 'md:pt-[28vh]'}`}
    >
      <header className={`space-y-4 text-center ${opened ? 'pb-4' : 'pb-8'} ${RISE}`}>
        {/* Keyed, so "Welcome to Zebri" giving way to the day's greeting rises in rather than cuts. */}
        <Heading key={greeting} className="type-title text-zebra-950 motion-safe:animate-rise-in md:type-display">
          {greeting}
        </Heading>
        {headline ? (
          <p
            key={headline.live ? 'live' : headline.text}
            aria-live="polite"
            className="mx-auto max-w-xl text-balance type-lead text-zebra-500 motion-safe:animate-rise-in"
          >
            {headline.live ? <TypedLine text={headline.text} /> : headline.text}
          </p>
        ) : null}
      </header>
      {opened ? (
        <div className={`${RISE} ${unfolding ? '' : DELAY[1]}`}>
          <AskZebri onQuickStart={onQuickStart} quickStarts={quickStarts} scoped={scoped} />
        </div>
      ) : null}
      <div className={`space-y-5 ${opened ? 'pt-5' : ''} ${RISE} ${DELAY[2]}`}>
        {shown && rows.length > 0 ? (
        <Panel
          as="section"
          aria-label="Up next"
          className={`p-2 ${returned ? 'motion-safe:animate-[swap-in_520ms_cubic-bezier(0.2,0.7,0.2,1)_both]' : ''}`}
        >
          <ul ref={list} aria-live="polite" className="divide-y divide-zebra-950/5">
            {rows.map((row) => (
              <li key={row.id}>
                <UpNextRow
                  lead={<Lead lead={row.lead} />}
                  title={row.title}
                  detail={row.detail}
                  trail={<Trail row={row} />}
                  action={
                    row.action
                      ? {
                          label: row.action.label,
                          primary: row.action.primary,
                          onClick: () => onAct(row.action!.act),
                        }
                      : undefined
                  }
                  onOpen={row.look ? () => onLook(row.look!) : undefined}
                />
              </li>
            ))}
          </ul>
        </Panel>
        ) : null}
        {/* All zeros on an empty account say nothing; the counts join with the first real work. */}
        {opened && (counts.enquiries || counts.outstanding || counts.unsigned) ? (
          <p
            className={`flex flex-wrap justify-center gap-x-6 gap-y-1 type-body text-zebra-500 ${unfolding ? 'motion-safe:animate-[rise-in_400ms_ease-out_1300ms_both]' : ''}`}
          >
            <Count
              value={String(counts.enquiries)}
              label="new enquiries"
              onClick={() => onCount('enquiries')}
            />
            <Count
              value={`$${counts.outstanding.toLocaleString('en-AU')}`}
              label="outstanding"
              onClick={() => onCount('outstanding')}
            />
            <Count
              value={String(counts.unsigned)}
              label="unsigned proposals"
              onClick={() => onCount('unsigned')}
            />
          </p>
        ) : null}
      </div>
    </div>
  );
}

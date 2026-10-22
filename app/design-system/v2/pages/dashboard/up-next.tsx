'use client';

import { useState } from 'react';

import { Avatar } from '@/components/ui-v2/avatar';
import { Badge } from '@/components/ui-v2/badge';
import { COLLAPSE_MS, Collapse } from '@/components/ui-v2/collapse';
import { IconCircle } from '@/components/ui-v2/icon-circle';
import { HeartIcon } from '@/components/ui-v2/icons';
import { Panel } from '@/components/ui-v2/panel';
import { TextLink } from '@/components/ui-v2/text-link';

import { useAccount } from './account';
import { dayText, lodgeBy } from './bdm/bdm-data';
import { useAllPaperwork, useBdmOn } from './bdm/bdm-store';
import { needsYou } from './bdm/status';
import { DRAFTS, agoText } from './demo-activity';
import { NEEDS_REPLY, NEXT_EVENT, type Message } from './demo-data';
import { homeCounts } from './home/counts';
import { ReplyDialog } from './home/reply-dialog';
import { RunSheetNudge } from './home/run-sheet-nudge';
import { money } from './payments/payments-data';
import { useSent } from './questionnaires/questionnaire-store';
import { useShowcase } from './showcase';
import { UpNextRow } from './up-next-row';

/**
 * Everything the dashboard shows under the "Ask Zebri" box: one panel of
 * rows (the next event, its run sheet while it still needs doing, then
 * messages waiting on a reply) and a single
 * line of counts beneath it. One surface instead of a grid of cards, so
 * the page reads as a short list, not a wall of widgets.
 *
 * Nothing opens in place: the event opens its run sheet in a dialog
 * (owned by Home, which Build a run sheet shares), a message opens
 * Zebri's drafted reply in a dialog. Sending a reply folds its row
 * away, so the list only ever holds what still needs the MC. Each count
 * leads to where those things live.
 *
 * @module app/design-system/v2/pages/dashboard/up-next
 */

/** "Today", "Tomorrow" or "In 3 days", by calendar day rather than hours. */
export function daysUntil(at: Date, now: Date): string {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(at) - day(now)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

/** Where a count leads. */
export type CountTarget = 'enquiries' | 'outstanding' | 'unsigned' | 'contracts' | 'questionnaires' | 'paperwork';

export interface UpNextProps {
  /** When the next event starts. */
  at: Date;
  now: Date;
  /** Opens the next event's run sheet. */
  onOpenEvent: () => void;
  /** Follows a count to where those things live. */
  onCount: (target: CountTarget) => void;
  /** Whether the Enquiries block is added; the new enquiries count only shows when it is. */
  enquiriesOn?: boolean | undefined;
}

/** The rows panel and the counts line. See {@link UpNextProps}. */
export function UpNext({ at, now, onOpenEvent, onCount, enquiriesOn = true }: UpNextProps) {
  const [replying, setReplying] = useState<Message | null>(null);
  // `leaving` rows are folding shut; `gone` rows have finished and unmount.
  const [leaving, setLeaving] = useState<string[]>([]);
  const [gone, setGone] = useState<string[]>([]);
  const sent = (id: string) => {
    setReplying(null);
    setLeaving((l) => [...l, id]);
    window.setTimeout(() => setGone((g) => [...g, id]), COLLAPSE_MS);
  };

  const when = at.toLocaleString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
  const account = useAccount();
  const counts = homeCounts(account.proposals, account.contracts, useSent());
  // Marriage paperwork to check or lodge, once the Lodge with BDM block is added.
  const papers = useAllPaperwork();
  // Need you first; with nothing urgent, how many are in progress, so the list is always a click away.
  const bdmOn = useBdmOn();
  const needing = papers.filter(needsYou);
  const open = papers.filter((p) => p.stage !== 'registered' && p.stage !== 'draft');
  // The soonest 14-day deadline among weddings waiting to be lodged.
  const nextDue = needing.filter((p) => p.stage === 'checked').map(lodgeBy).filter((d): d is Date => d !== null).sort((x, y) => x.getTime() - y.getTime())[0];
  const paperwork = !bdmOn
    ? null
    : needing.length
      ? { value: String(needing.length), label: `${needing.length === 1 ? 'marriage needs' : 'marriages need'} you${nextDue ? `, next due ${dayText(nextDue)}` : ''}` }
      : open.length
        ? { value: String(open.length), label: `${open.length === 1 ? 'marriage' : 'marriages'} in progress` }
        : null;
  const owed = money(counts.outstanding);
  // A still leaves the counts out: their first item is money owed, not the picture to sell.
  const showCounts = !useShowcase();
  return (
    <div className="space-y-5">
      {/* In a still, Up next is the focal point: lifted off the page, so the eye lands on what is next. */}
      <Panel as="section" aria-label="Up next" className={`p-2 ${showCounts ? '' : 'shadow-xl'}`}>
        <ul className="divide-y divide-hairline">
          <li>
            <UpNextRow
              lead={<IconCircle icon={HeartIcon} />}
              title={NEXT_EVENT.client}
              detail={when}
              trail={<Badge tone="brand">{daysUntil(at, now)}</Badge>}
              onOpen={onOpenEvent}
            />
          </li>
          <RunSheetNudge
            client={NEXT_EVENT.client}
            days={Math.round((at.getTime() - now.getTime()) / 86_400_000)}
            onOpen={onOpenEvent}
          />
          {NEEDS_REPLY.map((m, i) => ({ m, tone: i === 0 ? ('ink' as const) : ('muted' as const) }))
            // Tone comes from the original order, so a row's avatar keeps
            // its colour when the row above it is sent away.
            .filter(({ m }) => !gone.includes(m.from))
            .map(({ m, tone }) => (
              <li key={m.from}>
                <Collapse open={!leaving.includes(m.from)}>
                  <UpNextRow
                    lead={<Avatar name={m.from} tone={tone} />}
                    title={m.from.split(' ')[0] ?? m.from}
                    detail={m.preview}
                    trail={<span className="type-body text-zebra-400">{agoText(m.ago)}</span>}
                    onOpen={() => setReplying(m)}
                  />
                </Collapse>
              </li>
            ))}
        </ul>
      </Panel>
      {/* Counts as one line of links, not three tiles. A zero is left out, as on a new account's Home. */}
      <p className={`flex flex-wrap justify-center gap-x-6 gap-y-1 type-body text-zebra-500 ${showCounts ? '' : 'hidden'}`}>
        {enquiriesOn && counts.newEnquiries > 0 ? (
          <Count
            value={String(counts.newEnquiries)}
            label="new enquiries"
            onClick={() => onCount('enquiries')}
          />
        ) : null}
        {counts.outstanding > 0 ? <Count value={owed} label="outstanding" onClick={() => onCount('outstanding')} /> : null}
        {counts.unsignedProposals > 0 ? (
          <Count
            value={String(counts.unsignedProposals)}
            label="unsigned proposals"
            onClick={() => onCount('unsigned')}
          />
        ) : null}
        {counts.unsignedContracts > 0 ? (
          <Count value={String(counts.unsignedContracts)} label="unsigned contracts" onClick={() => onCount('contracts')} />
        ) : null}
        {counts.openQuestionnaires > 0 ? (
          <Count value={String(counts.openQuestionnaires)} label="unanswered questionnaires" onClick={() => onCount('questionnaires')} />
        ) : null}
        {paperwork ? <Count value={paperwork.value} label={paperwork.label} onClick={() => onCount('paperwork')} /> : null}
      </p>
      <ReplyDialog
        key={replying?.from ?? 'closed'}
        message={replying}
        draft={replying ? (DRAFTS[replying.from] ?? '') : ''}
        onSent={() => replying && sent(replying.from)}
        onClose={() => setReplying(null)}
      />
    </div>
  );
}

/**
 * One of the counts under Up next (and a new account's Home): a figure
 * and what it counts, as a `TextLink` leading to where they live. The
 * pages switch in place, so the link's own navigation is stopped.
 */
export function Count({
  value,
  label,
  onClick,
}: {
  value: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <TextLink
      href="#"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
    >
      {value} {label}
    </TextLink>
  );
}

'use client';

import { Heart } from 'lucide-react';
import { useState } from 'react';

import { Avatar } from '@/components/ui-v2/avatar';
import { Badge } from '@/components/ui-v2/badge';
import { COLLAPSE_MS, Collapse } from '@/components/ui-v2/collapse';
import { Panel } from '@/components/ui-v2/panel';

import { DRAFTS } from './demo-activity';
import { NEEDS_REPLY, NEXT_EVENT, type Message } from './demo-data';
import { homeCounts } from './home/counts';
import { ReplyDialog } from './home/reply-dialog';
import { UpNextRow } from './up-next-row';

/**
 * Everything the dashboard shows under the "Ask Zebri" box: one panel of
 * rows (the next event, then messages waiting on a reply) and a single
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
export type CountTarget = 'enquiries' | 'outstanding' | 'unsigned';

export interface UpNextProps {
  /** When the next event starts. */
  at: Date;
  now: Date;
  /** Opens the next event's run sheet. */
  onOpenEvent: () => void;
  /** Follows a count to where those things live. */
  onCount: (target: CountTarget) => void;
}

/** The rows panel and the counts line. See {@link UpNextProps}. */
export function UpNext({ at, now, onOpenEvent, onCount }: UpNextProps) {
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
  const counts = homeCounts();
  const owed = `$${counts.outstanding.toLocaleString('en-AU')}`;
  return (
    <div className="space-y-5">
      <Panel as="section" aria-label="Up next" className="p-2">
        <ul className="divide-y divide-zebra-950/5">
          <li>
            <UpNextRow
              lead={
                <span className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-grass-100 text-grass-800">
                  <Heart aria-hidden="true" strokeWidth={1.5} className="size-4" />
                </span>
              }
              title={NEXT_EVENT.client}
              detail={when}
              trail={<Badge tone="brand">{daysUntil(at, now)}</Badge>}
              onOpen={onOpenEvent}
            />
          </li>
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
                    trail={<span className="type-body text-zebra-400">{m.ago}</span>}
                    onOpen={() => setReplying(m)}
                  />
                </Collapse>
              </li>
            ))}
        </ul>
      </Panel>
      {/* Counts as one line of links, not three tiles. */}
      <p className="flex flex-wrap justify-center gap-x-6 gap-y-1 type-body text-zebra-500">
        <Count
          value={String(counts.newEnquiries)}
          label="new enquiries"
          onClick={() => onCount('enquiries')}
        />
        <Count value={owed} label="outstanding" onClick={() => onCount('outstanding')} />
        <Count
          value={String(counts.unsignedProposals)}
          label="unsigned proposals"
          onClick={() => onCount('unsigned')}
        />
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

/** One of the counts under Up next: a figure and what it counts, leading to where they live. */
export function Count({ value, label, onClick }: { value: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-check hover:text-zebra-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500"
    >
      <span className="type-label tabular-nums text-zebra-950">{value}</span> {label}
    </button>
  );
}

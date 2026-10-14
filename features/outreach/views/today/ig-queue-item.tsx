/**
 * One DM in today's Instagram queue. The main action is the copy-and-open
 * step; "Sent" appears as the primary action once the message is on the
 * clipboard, because that is the step the founder has to remember.
 *
 * @module features/outreach/views/today/ig-queue-item
 */
import { Ban, Check, Copy, ExternalLink, SkipForward } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { StatePill } from '@/components/ui/state-pill';
import type { IgQueueItem as IgItem } from '@/lib/outreach/services/queries';

import { formatSydneyTime } from '../prospects/labels';

/** Props for {@link IgQueueRow}. */
export interface IgQueueRowProps {
  item: IgItem;
  copied: boolean;
  /** Which action is in flight for this row, so only that button spins. */
  busy: 'copy' | 'sent' | 'skip' | 'cant' | null;
  onCopy: (item: IgItem) => void;
  onSent: (item: IgItem) => void;
  onSkip: (item: IgItem) => void;
  onCantDm: (item: IgItem) => void;
  onOpen: (prospectId: string) => void;
}

/** A single queued DM with its actions. */
export function IgQueueRow({ item, copied, busy, onCopy, onSent, onSkip, onCantDm, onOpen }: IgQueueRowProps) {
  const noHandle = item.handle.length === 0;
  return (
    <li className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onOpen(item.prospectId)}
          className="text-body font-medium text-text hover:underline cursor-pointer"
        >
          {item.name}
        </button>
        {item.handle && <span className="text-body text-text-muted">@{item.handle.replace(/^@/, '')}</span>}
        <span className="text-body text-text-subtle">Sequence step {item.step}</span>
        {item.overdue && <StatePill label="Overdue" tone="danger" dot="filled" />}
        {item.igStatus === 'private' && <StatePill label="Private account" tone="warning" />}
        {item.igStatus === 'not_found' && <StatePill label="Account not found" tone="warning" />}
        {copied && <StatePill label="Copied" tone="info" dot="filled" />}
        {!item.overdue && <span className="text-body text-text-subtle">Due {formatSydneyTime(item.scheduledFor)}</span>}
      </div>

      <p className="text-body text-text-muted whitespace-pre-wrap">{item.body}</p>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {copied ? (
          <Button className="w-full sm:w-auto" loading={busy === 'sent'} disabled={busy !== null} onClick={() => onSent(item)}>
            <Check size={14} strokeWidth={1.5} aria-hidden="true" />
            Sent
          </Button>
        ) : (
          <Button className="w-full sm:w-auto" loading={busy === 'copy'} disabled={busy !== null || noHandle} onClick={() => onCopy(item)}>
            <Copy size={14} strokeWidth={1.5} aria-hidden="true" />
            Copy &amp; open
            <ExternalLink size={14} strokeWidth={1.5} aria-hidden="true" />
          </Button>
        )}
        <Button variant="outline" className="w-full sm:w-auto" disabled={busy !== null} onClick={() => onSkip(item)}>
          <SkipForward size={14} strokeWidth={1.5} aria-hidden="true" />
          Skip
        </Button>
        <Button variant="ghost" className="w-full sm:w-auto" loading={busy === 'cant'} disabled={busy !== null} onClick={() => onCantDm(item)}>
          <Ban size={14} strokeWidth={1.5} aria-hidden="true" />
          Can&apos;t DM
        </Button>
      </div>
    </li>
  );
}

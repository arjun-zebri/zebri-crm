/**
 * "Needs attention": replies, bounces, bookings and failures from the
 * last three days. Opt-outs carry an Undo, since a mistaken opt-out is
 * the one thing the founder must be able to reverse in one click.
 *
 * @module features/outreach/views/today/attention-list
 */
import { Undo2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { StatePill, type StatePillTone } from '@/components/ui/state-pill';
import { undoOptOutAction } from '@/features/outreach/actions';
import { useOutreachMutation } from '@/features/outreach/hooks';
import type { AttentionItem } from '@/lib/outreach/services/queries';

import { formatRelative } from '../prospects/labels';

import { TodayList, TodaySection } from './today-section';

/** Plain-words label and tone for each attention event type. */
const ATTENTION: Record<string, { label: string; tone: StatePillTone }> = {
  replied: { label: 'Replied', tone: 'success' },
  opted_out: { label: 'Opted out', tone: 'neutral' },
  email_bounced: { label: 'Bounced', tone: 'danger' },
  demo_booked: { label: 'Booked a demo', tone: 'success' },
  email_failed: { label: 'Email failed', tone: 'danger' },
};

/** Props for {@link AttentionList}. */
export interface AttentionListProps {
  items: AttentionItem[];
  onOpen: (prospectId: string) => void;
}

/** Recent events that need the founder's eyes. */
export function AttentionList({ items, onOpen }: AttentionListProps) {
  const undo = useOutreachMutation(undoOptOutAction, 'Opt-out undone');
  return (
    <TodaySection title="Needs attention" count={items.length}>
      {items.length === 0 ? (
        <Empty size="sm" title="Nothing needs you" description="Replies, bounces and bookings from the last three days show here." />
      ) : (
        <TodayList>
          {items.map((item) => {
            const meta = ATTENTION[item.type] ?? { label: item.type, tone: 'neutral' as const };
            const undoing = undo.isPending && undo.variables === item.prospectId;
            return (
              <li key={item.eventId} className="flex items-start gap-3 p-4">
                <button type="button" onClick={() => onOpen(item.prospectId)} className="flex-1 min-w-0 space-y-1 text-left cursor-pointer">
                  <span className="flex flex-wrap items-center gap-2">
                    <StatePill label={meta.label} tone={meta.tone} />
                    <span className="text-body font-medium text-text">{item.name}</span>
                    <span className="text-body text-text-subtle">{formatRelative(item.at)}</span>
                  </span>
                  {item.snippet && <span className="block text-body text-text-muted line-clamp-2">{item.snippet}</span>}
                </button>
                {item.type === 'opted_out' && (
                  <Button variant="outline" loading={undoing} disabled={undo.isPending} onClick={() => undo.mutate(item.prospectId)}>
                    <Undo2 size={14} strokeWidth={1.5} aria-hidden="true" />
                    Undo
                  </Button>
                )}
              </li>
            );
          })}
        </TodayList>
      )}
    </TodaySection>
  );
}

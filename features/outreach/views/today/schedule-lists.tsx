/**
 * Read-only schedule lists on Today: upcoming demos and the emails the
 * sender will send today. Rows open the prospect; nothing here edits.
 *
 * @module features/outreach/views/today/schedule-lists
 */
import { Empty } from '@/components/ui/empty';
import type { TodayData } from '@/lib/outreach/services/queries';

import { formatSydneyDateTime, formatSydneyTime } from '../prospects/labels';

import { TodayList, TodaySection } from './today-section';

/** Props for {@link DemosList}. */
export interface DemosListProps {
  items: TodayData['upcomingDemos'];
  onOpen: (prospectId: string) => void;
}

/** Booked demos from the booking page, matched to prospects by email. */
export function DemosList({ items, onOpen }: DemosListProps) {
  return (
    <TodaySection title="Upcoming demos" count={items.length}>
      {items.length === 0 ? (
        <Empty size="sm" title="No demos booked" description="Demos booked through your booking page show here." />
      ) : (
        <TodayList>
          {items.map((item) => (
            <li key={`${item.prospectId}-${item.startsAt}`}>
              <button type="button" onClick={() => onOpen(item.prospectId)} className="flex w-full items-center justify-between gap-3 p-4 text-left cursor-pointer">
                <span className="text-body font-medium text-text truncate">{item.name}</span>
                <span className="text-body text-text-muted whitespace-nowrap">{formatSydneyDateTime(item.startsAt)}</span>
              </button>
            </li>
          ))}
        </TodayList>
      )}
    </TodaySection>
  );
}

/** Props for {@link EmailQueueList}. */
export interface EmailQueueListProps {
  items: TodayData['emailQueue'];
  onOpen: (prospectId: string) => void;
}

/** Today's scheduled emails, in send order, with their Sydney send time. */
export function EmailQueueList({ items, onOpen }: EmailQueueListProps) {
  return (
    <TodaySection title="Email queue" count={items.length}>
      {items.length === 0 ? (
        <Empty size="sm" title="No emails queued" description="Emails scheduled for today appear here in send order." />
      ) : (
        <TodayList>
          {items.map((item) => (
            <li key={item.messageId}>
              <button type="button" onClick={() => onOpen(item.prospectId)} className="flex w-full items-center gap-4 p-4 text-left cursor-pointer">
                <span className="w-20 shrink-0 text-body text-text-muted">{formatSydneyTime(item.scheduledFor)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-medium text-text truncate">{item.name}</span>
                  <span className="block text-body text-text-muted truncate">{item.subject ?? 'No subject'}</span>
                </span>
              </button>
            </li>
          ))}
        </TodayList>
      )}
    </TodaySection>
  );
}

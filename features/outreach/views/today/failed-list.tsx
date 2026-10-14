/**
 * Failed emails with a Retry. A retry re-queues the message; the sender
 * picks it up on the next tick, so nothing sends straight from the click.
 *
 * @module features/outreach/views/today/failed-list
 */
import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { retryMessageAction } from '@/features/outreach/actions';
import { useOutreachMutation } from '@/features/outreach/hooks';
import type { TodayData } from '@/lib/outreach/services/queries';

import { TodayList, TodaySection } from './today-section';

/** Props for {@link FailedList}. */
export interface FailedListProps {
  items: TodayData['failed'];
  onOpen: (prospectId: string) => void;
}

/** Pull the message id out of the mutation variables (typed unknown at the hook). */
function messageIdOf(variables: unknown): string | undefined {
  return (variables as { messageId?: string } | undefined)?.messageId;
}

/** Emails that failed to send. */
export function FailedList({ items, onOpen }: FailedListProps) {
  const retry = useOutreachMutation(retryMessageAction, 'Retry queued');
  return (
    <TodaySection title="Failed emails" count={items.length}>
      {items.length === 0 ? (
        <Empty size="sm" icon={RefreshCw} title="No failed emails" description="Anything that fails to send shows here with a retry." />
      ) : (
        <TodayList>
          {items.map((item) => {
            const busy = retry.isPending && messageIdOf(retry.variables) === item.messageId;
            return (
              <li key={item.messageId} className="flex items-center gap-3 p-4">
                <button type="button" onClick={() => onOpen(item.prospectId)} className="flex-1 min-w-0 text-left cursor-pointer">
                  <span className="block text-body font-medium text-text truncate">{item.name}</span>
                  {item.error && <span className="block text-body text-text-muted truncate">{item.error}</span>}
                </button>
                <Button variant="outline" loading={busy} disabled={retry.isPending} onClick={() => retry.mutate({ messageId: item.messageId })}>
                  Retry
                </Button>
              </li>
            );
          })}
        </TodayList>
      )}
    </TodaySection>
  );
}

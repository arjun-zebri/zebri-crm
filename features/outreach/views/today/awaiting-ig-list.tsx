/**
 * "Replied on Instagram?": people whose last DM went out and who have
 * not been marked as replied. Instagram replies never reach Zebri, so
 * the founder confirms them here.
 *
 * Marking someone replied stops their sequence, so the button asks first
 * instead of acting on one click.
 *
 * @module features/outreach/views/today/awaiting-ig-list
 */
import { MessageSquare } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Empty } from '@/components/ui/empty';
import { markRepliedAction } from '@/features/outreach/actions';
import { useOutreachMutation } from '@/features/outreach/hooks';
import type { TodayData } from '@/lib/outreach/services/queries';

import { formatRelative } from '../prospects/labels';

import { TodayList, TodaySection } from './today-section';

/** One person whose last IG DM is waiting on a reply check. */
type AwaitingItem = TodayData['awaitingIgReply'][number];

/** Props for {@link AwaitingIgList}. */
export interface AwaitingIgListProps {
  items: AwaitingItem[];
  onOpen: (prospectId: string) => void;
}

/** Pull the prospect id out of the mutation variables (typed unknown at the hook). */
function idOf(variables: unknown): string | undefined {
  return (variables as { id?: string } | undefined)?.id;
}

/** DMs sent with no reply recorded yet. */
export function AwaitingIgList({ items, onOpen }: AwaitingIgListProps) {
  const replied = useOutreachMutation(markRepliedAction, 'Marked replied');
  const [confirming, setConfirming] = useState<AwaitingItem | null>(null);
  return (
    <TodaySection title="Replied on Instagram?" count={items.length}>
      {items.length === 0 ? (
        <Empty size="sm" icon={MessageSquare} title="No open DMs" description="Sent DMs with no reply yet show here." />
      ) : (
        <TodayList>
          {items.map((item) => {
            const busy = replied.isPending && idOf(replied.variables) === item.prospectId;
            return (
              <li key={item.prospectId} className="flex items-center gap-3 p-4">
                <button type="button" onClick={() => onOpen(item.prospectId)} className="flex-1 min-w-0 text-left cursor-pointer">
                  <span className="block text-body font-medium text-text truncate">{item.name}</span>
                  <span className="block text-body text-text-muted truncate">
                    {item.handle && `@${item.handle.replace(/^@/, '')} · `}DM sent {formatRelative(item.lastDmAt)}
                  </span>
                </button>
                <Button variant="outline" loading={busy} disabled={replied.isPending} onClick={() => setConfirming(item)}>
                  Mark replied
                </Button>
              </li>
            );
          })}
        </TodayList>
      )}
      <ConfirmDialog
        open={confirming !== null}
        title={`Mark ${confirming?.name ?? 'this person'} as replied?`}
        description="Their sequence stops, so no more steps go out to them."
        confirmLabel="Mark as replied"
        loading={replied.isPending}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (!confirming) return;
          replied.mutate({ id: confirming.prospectId, channel: 'instagram' }, { onSuccess: () => setConfirming(null) });
        }}
      />
    </TodaySection>
  );
}

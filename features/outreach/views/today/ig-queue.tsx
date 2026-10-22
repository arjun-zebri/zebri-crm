/**
 * Today's Instagram DM queue: the core daily task. Owns the session
 * state that matters to the founder ("which of these have I copied and
 * not yet marked sent") and the mutations behind each row.
 *
 * @module features/outreach/views/today/ig-queue
 */
import { Instagram } from 'lucide-react';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Empty } from '@/components/ui/empty';
import { useToast } from '@/components/ui/toast';
import { igCantDmAction, igCopiedAction, igSentAction, igSkipAction } from '@/features/outreach/actions';
import { useOutreachMutation } from '@/features/outreach/hooks';
import type { IgQueueItem as IgItem } from '@/lib/outreach/services/queries';

import { IgQueueRow, type IgQueueRowProps } from './ig-queue-item';
import { SkipDialog } from './skip-dialog';
import { TodayList, TodaySection } from './today-section';

/** Props for {@link IgQueue}. */
export interface IgQueueProps {
  items: IgItem[];
  onOpen: (prospectId: string) => void;
}

/** Pull the message id out of a mutation's variables (typed unknown at the hook). */
function messageIdOf(variables: unknown): string | undefined {
  return (variables as { messageId?: string } | undefined)?.messageId;
}

/**
 * Copy the DM, open the person's Instagram DM, and record the copy.
 *
 * "Copied" comes from the server (`copiedAt`) so a reload keeps it. The
 * local set is an optimistic overlay for the moment between the copy and
 * the refetch. It is the only thing standing between the founder and a
 * DM sent twice, so it must not be lost on a failed write either: the
 * overlay is removed again when the copy is not recorded.
 *
 * The window opens before the clipboard await: browsers only allow a
 * popup inside the click, and a slow clipboard call would lose that.
 */
export function IgQueue({ items, onOpen }: IgQueueProps) {
  const { toast } = useToast();
  const [optimisticCopied, setOptimisticCopied] = useState<Set<string>>(() => new Set());
  const [skipping, setSkipping] = useState<IgItem | null>(null);
  const [cantDming, setCantDming] = useState<IgItem | null>(null);
  // Why: a double click would open two DM windows and copy twice. The row goes busy and disabled until the copy settles.
  const [copyingId, setCopyingId] = useState<string | null>(null);

  const copyMut = useOutreachMutation(igCopiedAction);
  const sentMut = useOutreachMutation(igSentAction, 'Marked sent');
  const skipMut = useOutreachMutation(igSkipAction, 'DM skipped');
  const cantMut = useOutreachMutation(igCantDmAction, "Marked as can't DM");

  function copyAndOpen(item: IgItem) {
    if (copyingId !== null) return;
    setCopyingId(item.messageId);
    const handle = item.handle.replace(/^@/, '');
    const write = navigator.clipboard?.writeText(item.body) ?? Promise.reject(new Error('Clipboard unavailable'));
    window.open(`https://ig.me/m/${handle}`, '_blank', 'noopener,noreferrer');
    write
      .then(() => {
        setOptimisticCopied((prev) => new Set(prev).add(item.messageId));
        copyMut.mutate({ messageId: item.messageId }, { onError: () => forget(item.messageId) });
      })
      .catch(() => toast('Could not copy. Select the message and copy it by hand.', 'error'))
      .finally(() => setCopyingId(null));
  }

  function forget(messageId: string) {
    setOptimisticCopied((prev) => {
      const next = new Set(prev);
      next.delete(messageId);
      return next;
    });
  }

  /** Which action (if any) is in flight for this row. */
  function busyFor(messageId: string): IgQueueRowProps['busy'] {
    if (copyingId === messageId || (copyMut.isPending && messageIdOf(copyMut.variables) === messageId)) return 'copy';
    if (sentMut.isPending && messageIdOf(sentMut.variables) === messageId) return 'sent';
    if (skipMut.isPending && messageIdOf(skipMut.variables) === messageId) return 'skip';
    if (cantMut.isPending && messageIdOf(cantMut.variables) === messageId) return 'cant';
    return null;
  }

  return (
    <TodaySection title="Instagram DMs" count={items.length}>
      {items.length === 0 ? (
        <Empty size="sm" icon={Instagram} title="No DMs due today" description="New ones appear here as the sequence reaches them." />
      ) : (
        <TodayList>
          {items.map((item) => (
            <IgQueueRow
              key={item.messageId}
              item={item}
              copied={item.copiedAt !== null || optimisticCopied.has(item.messageId)}
              busy={busyFor(item.messageId)}
              onOpen={onOpen}
              onCopy={copyAndOpen}
              onSent={(it) => sentMut.mutate({ messageId: it.messageId }, { onSuccess: () => forget(it.messageId) })}
              onSkip={setSkipping}
              onCantDm={(it) => setCantDming(it)}
            />
          ))}
        </TodayList>
      )}
      <SkipDialog
        name={skipping?.name ?? null}
        pending={skipMut.isPending}
        onClose={() => setSkipping(null)}
        onConfirm={(reason) => {
          if (!skipping) return;
          skipMut.mutate({ messageId: skipping.messageId, reason }, { onSuccess: () => setSkipping(null) });
        }}
      />
      {/* Can't DM stops every later IG step for this person, so it asks first. */}
      <ConfirmDialog
        open={cantDming !== null}
        title={`Mark ${cantDming?.name ?? 'this person'} as can't DM?`}
        description="Their Instagram DMs stop, and the rest of their Instagram steps are skipped."
        confirmLabel="Mark as can't DM"
        loading={cantMut.isPending}
        onCancel={() => setCantDming(null)}
        onConfirm={() => {
          if (!cantDming) return;
          cantMut.mutate({ messageId: cantDming.messageId }, { onSuccess: () => setCantDming(null) });
        }}
      />
    </TodaySection>
  );
}

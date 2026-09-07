'use client';

/**
 * The Done strip under the Upcoming list.
 *
 * Collapsed by default, and absent entirely when there is nothing in
 * it: a permanent "Done (0)" on a fresh account is a promise the page
 * has not earned yet. The count comes from a cheap `head` query beside
 * the queue; the rows themselves are only fetched when the MC opens it.
 *
 * Grouped by the day the work was finished rather than by whatever the
 * live list is grouped by, because the only question asked of finished
 * work is "what did I just do".
 *
 * @module app/(dashboard)/workflows/done-section
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { Loading } from '@/components/ui/loading';
import type { QueueItem } from '@/lib/workflows/queue';

import { DoneList } from './done-list';
import { countDoneAction, loadDoneAction, untickStepAction } from './instance-actions';
import { groupDoneItems } from './queue-grouping';

/** Shared with the queue so un-ticking refreshes both lists. */
export const DONE_KEY = ['workflow-done'] as const;
const DONE_COUNT_KEY = ['workflow-done-count'] as const;

export interface DoneSectionProps {
  /** The MC's IANA timezone, for the day bands and the times. */
  timezone: string;
  /** Opens the shared step detail modal. */
  onOpen: (stepId: string) => void;
  /** Refreshes the live queue after an un-tick. */
  onRestored: () => void;
}

/** The collapsible Done strip. See {@link DoneSectionProps}. */
export function DoneSection({ timezone, onOpen, onRestored }: DoneSectionProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const count = useQuery({
    queryKey: [...DONE_COUNT_KEY],
    queryFn: async (): Promise<number> => {
      const res = await countDoneAction();
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
  });

  const rows = useQuery({
    queryKey: [...DONE_KEY],
    queryFn: async (): Promise<QueueItem[]> => {
      const res = await loadDoneAction();
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    // Nothing is fetched until the MC asks for it.
    enabled: open,
  });

  const untick = useMutation({
    mutationFn: async (stepId: string) => {
      const res = await untickStepAction({ stepId });
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DONE_KEY });
      void queryClient.invalidateQueries({ queryKey: DONE_COUNT_KEY });
      onRestored();
    },
  });

  const buckets = useMemo(() => groupDoneItems(rows.data ?? [], timezone), [rows.data, timezone]);

  // Hidden rather than shown empty, and hidden while the count is still
  // in flight: a strip that appears a second after the list settles
  // pushes the page around under the MC's cursor.
  if (!count.data) return null;

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-3 text-body text-text-muted hover:text-text sm:px-4"
      >
        <ChevronRight
          size={16}
          strokeWidth={1.5}
          className={`transition-transform ${open ? 'rotate-90' : ''}`}
        />
        Done ({count.data})
      </button>

      {open ? (
        rows.isLoading ? (
          <div className="px-3 pb-4 sm:px-4">
            <Loading />
          </div>
        ) : rows.error ? (
          <div className="px-3 pb-4 sm:px-4">
            <ErrorState
              title="Could not load what you have finished"
              error={rows.error as Error}
              onRetry={() => void rows.refetch()}
            />
          </div>
        ) : (
          <DoneList
            buckets={buckets}
            timezone={timezone}
            onUntick={(stepId) => untick.mutate(stepId)}
            onOpen={onOpen}
          />
        )
      ) : null}
    </div>
  );
}

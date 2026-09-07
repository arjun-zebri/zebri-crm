'use client';

/**
 * Upcoming: everything across every couple, in the order it happens.
 *
 * The first thing an MC sees when they open the app, and the reason the
 * tab is not called Today: most of what makes a wedding go well is
 * decided in the fortnight before it, and a view that only showed today
 * hid the two things they most needed to see coming.
 *
 * One list of everything, grouped down a rail on the left: by date (the
 * default), by couple, or by who does the work. The toolbar control
 * regroups rather than filters, so no grouping ever hides a step.
 * Opening a row is where the deciding happens; see
 * {@link StepDetailModal}.
 *
 * @module app/(dashboard)/workflows/workflows-queue
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import type { QueueResult } from '@/lib/workflows/queue';

import { DoneSection } from './done-section';
import {
  loadQueueAction,
  rescheduleStepAction,
  skipStepAction,
  tickStepAction,
} from './instance-actions';
import { QueueAddStep } from './queue-add-step';
import { flattenQueue } from './queue-buckets';
import { QueueGroupMenu } from './queue-group-menu';
import { DEFAULT_GROUP_BY, groupQueueItems, type QueueGroupBy } from './queue-grouping';
import { inDays } from './queue-labels';
import { StepDetailModal } from './step-detail-modal';
import { UpcomingList } from './upcoming-list';
import { WorkflowsEmpty } from './workflows-empty';
import { UpcomingSkeleton } from './workflows-skeletons';

const QUEUE_KEY = ['workflow-queue'] as const;

const EMPTY: QueueResult = {
  review: [],
  overdue: [],
  today: [],
  upcoming: [],
  sendingToday: [],
};

export interface WorkflowsQueueProps {
  /** The MC's IANA timezone, for the bands and the relative labels. */
  timezone: string;
}

/** The Upcoming tab. See {@link WorkflowsQueueProps}. */
export function WorkflowsQueue({ timezone }: WorkflowsQueueProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [groupBy, setGroupBy] = useState<QueueGroupBy>(DEFAULT_GROUP_BY);
  const [adding, setAdding] = useState(false);
  const [openStepId, setOpenStepId] = useState<string | null>(null);

  // Anything that moves a step also moves it across the Done strip, so
  // both lists and the strip's count refresh together. Ticking a row and
  // watching "Done (11)" stay at eleven reads as a failed save.
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
    void queryClient.invalidateQueries({ queryKey: ['workflow-done'] });
    void queryClient.invalidateQueries({ queryKey: ['workflow-done-count'] });
  };

  const query = useQuery({
    queryKey: [...QUEUE_KEY],
    queryFn: async (): Promise<QueueResult> => {
      const res = await loadQueueAction({});
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
  });

  const tick = useMutation({
    mutationFn: async (stepId: string) => {
      const res = await tickStepAction({ stepId });
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: invalidate,
  });

  const snooze = useMutation({
    mutationFn: async ({ stepId, days }: { stepId: string; days: number }) => {
      const res = await rescheduleStepAction({ stepId, dueAt: inDays(days) });
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: invalidate,
  });

  const skip = useMutation({
    mutationFn: async (stepId: string) => {
      const res = await skipStepAction({ stepId });
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: invalidate,
  });

  const all = useMemo(() => flattenQueue(query.data ?? EMPTY), [query.data]);

  // Grouping client-side keeps the menu instant, and the queue is capped
  // at a couple of hundred rows. Nothing is ever hidden: every grouping
  // holds every step, so the count below is the whole queue.
  const buckets = useMemo(() => groupQueueItems(all, groupBy, timezone), [all, groupBy, timezone]);

  const total = buckets.reduce((sum, bucket) => sum + bucket.items.length, 0);

  // No card around the list, matching the couples list and the template
  // grid: a bordered box inside the page put a border inside a border,
  // and the two Workflows tabs then read as two different pages. The
  // toolbar sits on the page and the list below it takes the rest of
  // the height and does its own scrolling.
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <QueueGroupMenu value={groupBy} onChange={setGroupBy} />
        <Button onClick={() => setAdding(true)}>
          <Plus size={16} strokeWidth={1.5} />
          Add a to-do
        </Button>
      </div>

      <QueueAddStep
        isOpen={adding}
        onClose={() => setAdding(false)}
        onAdded={invalidate}
      />

      {/* The scrolling body. It takes the height the toolbar leaves, so
          the list runs to the bottom of the screen and long queues
          scroll under a toolbar that stays put. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {query.isLoading ? (
          <UpcomingSkeleton />
        ) : query.error ? (
          <div className="py-4">
            <ErrorState
              title="Could not load your day"
              error={query.error as Error}
              onRetry={() => void query.refetch()}
            />
          </div>
        ) : total === 0 ? (
          // Grouping never empties the list, so there is only one empty
          // state to write: there is genuinely nothing to do.
          <WorkflowsEmpty
            icon={CheckCircle2}
            title="Nothing coming up"
            description="Every step on every couple is up to date. Steps appear here as their dates come around."
          />
        ) : (
          <UpcomingList
            buckets={buckets}
            timezone={timezone}
            groupBy={groupBy}
            onTick={(stepId) => tick.mutate(stepId)}
            onOpen={setOpenStepId}
            onSnooze={(stepId, days) => snooze.mutate({ stepId, days })}
            onSkip={(stepId) => skip.mutate(stepId)}
            onOpenCouple={(coupleId) => router.push(`/couples?openCouple=${coupleId}`)}
          />
        )}

        {/* Inside the scrolling body, under the last band: finished work
            belongs at the end of the list it came from, not in a tab of
            its own. It hides itself when there is nothing in it. */}
        {query.isLoading ? null : (
          <DoneSection timezone={timezone} onOpen={setOpenStepId} onRestored={invalidate} />
        )}
      </div>

      <StepDetailModal
        stepId={openStepId}
        onClose={() => setOpenStepId(null)}
        onSettled={invalidate}
      />
    </div>
  );
}

'use client';

/**
 * Admin > Outreach > Today: the founder's daily checklist. Loads the
 * Today read model once (refreshing each minute).
 *
 * Until setup is finished, the "Get set up" guide leads the page and the
 * quiet-day state is held back: an empty Today before setup reads as
 * broken, when it is simply not ready yet. Lists still render when they
 * have something in them. Every prospect name opens the shared prospect modal.
 *
 * @module features/outreach/views/today-view
 */
import { CircleCheck } from 'lucide-react';
import { useState } from 'react';

import { Empty } from '@/components/ui/empty';
import { ErrorState } from '@/components/ui/error-state';
import { useSendStatus, useSetupProgress, useToday } from '@/features/outreach/hooks';
import { ProspectModal } from '@/features/outreach/views/prospects/prospect-modal';
import type { TodayData } from '@/lib/outreach/services/queries';

import { AttentionList } from './today/attention-list';
import { AwaitingIgList } from './today/awaiting-ig-list';
import { FailedList } from './today/failed-list';
import { IgQueue } from './today/ig-queue';
import { DemosList, EmailQueueList } from './today/schedule-lists';
import { SendStatusLine } from './today/send-status-line';
import { SetupGuide } from './today/setup-guide';
import { TodayBanners } from './today/today-banners';
import { TodaySkeleton } from './today/today-skeleton';

/** True when no Today list has anything in it. */
export function isQuietDay(d: TodayData): boolean {
  return [d.igQueue, d.attention, d.awaitingIgReply, d.failed, d.upcomingDemos, d.emailQueue].every((l) => l.length === 0);
}

/** The Today view. */
export function TodayView() {
  const today = useToday();
  const setup = useSetupProgress();
  const sendStatus = useSendStatus();
  const [openId, setOpenId] = useState<string | null>(null);

  if (today.isPending) return <TodaySkeleton />;
  if (today.isError) return <ErrorState error={today.error} onRetry={() => void today.refetch()} />;

  const d = today.data;
  // Why: while setup is loading or unfinished, the guide owns the page's empty state. An error
  // loading setup falls through to the normal Today, so a broken guide never hides the daily work.
  const guideShown = setup.data !== undefined && !setup.data.complete;
  const showCaughtUp = isQuietDay(d) && !guideShown && !setup.isPending;
  // Why: when nothing is due AND sending is blocked, "All caught up" is misleading. Say why nothing goes out.
  const blocked = sendStatus.data?.blocked ?? false;

  return (
    <div className="space-y-8">
      {sendStatus.data && <SendStatusLine status={sendStatus.data} />}
      <TodayBanners sendingPaused={d.sendingPaused} pausedReason={d.pausedReason} />

      {guideShown && setup.data && <SetupGuide setup={setup.data} />}

      {showCaughtUp ? (
        blocked && sendStatus.data ? (
          <Empty icon={CircleCheck} title="Sending is blocked" description={sendStatus.data.headline} />
        ) : (
          <Empty
            icon={CircleCheck}
            title="All caught up"
            description="No DMs to send, replies to read or emails going out today. New ones appear here as campaigns run."
          />
        )
      ) : (
        <>
          {d.igQueue.length > 0 && <IgQueue items={d.igQueue} onOpen={setOpenId} />}
          {d.attention.length > 0 && <AttentionList items={d.attention} onOpen={setOpenId} />}
          {d.awaitingIgReply.length > 0 && <AwaitingIgList items={d.awaitingIgReply} onOpen={setOpenId} />}
          {d.failed.length > 0 && <FailedList items={d.failed} onOpen={setOpenId} />}
          {d.upcomingDemos.length > 0 && <DemosList items={d.upcomingDemos} onOpen={setOpenId} />}
          {d.emailQueue.length > 0 && <EmailQueueList items={d.emailQueue} onOpen={setOpenId} />}
        </>
      )}

      <ProspectModal prospectId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

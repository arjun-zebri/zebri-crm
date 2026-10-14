/**
 * Top-of-page warning when sending is paused, with Resume beside it.
 * A missing mailbox is not a banner any more: the Ready to send
 * checklist under it covers that with the rest of setup.
 *
 * @module features/outreach/views/today/today-banners
 */
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { resumeSendingAction } from '@/features/outreach/actions';
import { useOutreachMutation } from '@/features/outreach/hooks';

/** Props for {@link TodayBanners}. */
export interface TodayBannersProps {
  sendingPaused: boolean;
  pausedReason: string | null;
}

/** Renders nothing when everything is healthy. */
export function TodayBanners({ sendingPaused, pausedReason }: TodayBannersProps) {
  const resume = useOutreachMutation(resumeSendingAction, 'Sending resumed');
  if (!sendingPaused) return null;
  return (
    <Callout tone="warning">
      <span className="flex flex-wrap items-center gap-3">
        <span className="flex-1 min-w-0">
          Sending is paused.{pausedReason ? ` ${pausedReason}` : ''}
        </span>
        <Button variant="outline" loading={resume.isPending} disabled={resume.isPending} onClick={() => resume.mutate(undefined)}>
          Resume sending
        </Button>
      </span>
    </Callout>
  );
}

'use client';

/**
 * Warning shown while sending is paused, with the one action that
 * resumes it. Renders nothing when sending is running. Used on Settings
 * and on Campaigns, so both places say the same thing.
 *
 * @module features/outreach/views/settings/sending-pause
 */
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { resumeSendingAction } from '@/features/outreach/actions';
import { useOutreachMutation } from '@/features/outreach/hooks';

/**
 * @param props.paused - Whether sending is currently paused.
 * @param props.reason - Why the pause was set, if the system recorded one.
 */
export function SendingPause({ paused, reason }: { paused: boolean; reason: string | null }) {
  const resume = useOutreachMutation(resumeSendingAction, 'Sending resumed');
  if (!paused) return null;
  // Why: the id is the target of the "Sending not paused" checklist row.
  return (
    <div id="sending-pause">
      <Callout tone="warning">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{reason ?? 'Sending is paused.'}</span>
          <Button variant="outline" loading={resume.isPending} onClick={() => resume.mutate(undefined)}>
            Resume sending
          </Button>
        </div>
      </Callout>
    </div>
  );
}

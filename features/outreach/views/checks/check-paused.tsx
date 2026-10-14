'use client';

/**
 * Visible state for a check that stopped on a failed batch. The driver
 * keeps the page quiet; this line tells the founder the check is waiting
 * and offers Retry, instead of a toast that disappears.
 *
 * @module features/outreach/views/checks/check-paused
 */
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';

/** Props for {@link CheckPaused}. */
export interface CheckPausedProps {
  /** Plain reason from the failed batch, shown after "Check paused.". */
  message: string;
  onRetry: () => void;
}

/** "Check paused. <reason>" with a Retry button. Shown only while the driver is stopped on an error. */
export function CheckPaused({ message, onRetry }: CheckPausedProps) {
  return (
    <Callout tone="warning">
      <span className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1">Check paused. {message}</span>
        <Button variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </span>
    </Callout>
  );
}

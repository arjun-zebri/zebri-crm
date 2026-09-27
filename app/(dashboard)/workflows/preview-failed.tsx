'use client';

/**
 * What an email preview shows when it could not be rendered at all.
 *
 * A danger callout with Try again, in place of the frame: a skeleton that
 * pulses forever reads as "still loading" and gives the MC no way out.
 *
 * @module app/(dashboard)/workflows/preview-failed
 */

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';

export interface PreviewFailedProps {
  /** Why the render failed, as the server action said. */
  error: string;
  onRetry: () => void;
}

/** The failed-preview state. See {@link PreviewFailedProps}. */
export function PreviewFailed({ error, onRetry }: PreviewFailedProps) {
  return (
    <Callout tone="danger">
      <span className="flex flex-wrap items-center gap-2">
        <span>Could not refresh the preview: {error}</span>
        <Button variant="ghost" onClick={onRetry}>
          Try again
        </Button>
      </span>
    </Callout>
  );
}

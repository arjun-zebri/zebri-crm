'use client';

/**
 * The one line that asks for attention on the Prospects page: people the
 * checks could not settle on their own. Shown only when there are some, and
 * opens the needs-review queue (a mode of this page, not a dialog, so the
 * A / I / S keys keep working).
 *
 * @module features/outreach/views/prospects/review-callout
 */
import { Button } from '@/components/ui/button';

/** Props for {@link ReviewCallout}. */
export interface ReviewCalloutProps {
  /** People waiting for a decision. The parent hides this at zero. */
  count: number;
  onReview: () => void;
}

/** "N need review · Review now", on one row that wraps on a phone. */
export function ReviewCallout({ count, onReview }: ReviewCalloutProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-control bg-surface-muted px-3 py-2">
      <p className="flex items-center gap-2 text-body text-text">
        <span className="size-1.5 rounded-pill bg-warning" aria-hidden="true" />
        {count} {count === 1 ? 'prospect needs' : 'prospects need'} review
      </p>
      <Button variant="outline" onClick={onReview}>
        Review now
      </Button>
    </div>
  );
}

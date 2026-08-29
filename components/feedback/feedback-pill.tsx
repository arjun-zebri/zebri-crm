'use client';

import { Flag } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * The floating Feedback control, bottom-right on every dashboard page.
 *
 * `z-[150]` clears the whole overlay ladder (`top` panels sit at `z-[130]`)
 * and stays under toasts at `z-[200]`. The pill has to stay reachable with a
 * modal open, since a modal is exactly where a bug tends to show itself; at
 * the old `z-40` the backdrop's blur left it visible but unusable. The
 * launcher hides it while the feedback modal itself is open, so it never
 * floats over its own form.
 *
 * It permanently occupies roughly the rightmost 140px of the bottom edge, so
 * anything else anchored there has to be moved clear. Three surfaces already
 * were: the toast stack (`components/ui/toast`, offset up to `bottom-20`), the
 * payments footer total (`pr-40`) and the branding canvas zoom widget
 * (`right-40`). Add to that list rather than nudging the pill.
 *
 * @module components/feedback/feedback-pill
 */
export interface FeedbackPillProps {
  onClick: () => void;
}

/** Renders the pill. See {@link FeedbackPillProps}. */
export function FeedbackPill({ onClick }: FeedbackPillProps) {
  return (
    <Button
      shape="pill"
      variant="primary"
      onClick={onClick}
      // Kept out of any screenshot the pill itself produces.
      data-capture-hide
      className="fixed bottom-6 right-6 z-[150] gap-1.5 shadow-lg"
    >
      <Flag size={14} strokeWidth={1.5} />
      Feedback
    </Button>
  );
}

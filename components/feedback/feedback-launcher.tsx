'use client';

import { useState, useSyncExternalStore } from 'react';

import { FeedbackModal } from './feedback-modal';
import { FeedbackPill } from './feedback-pill';

/**
 * Mounts the Feedback pill and its modal on every dashboard page.
 *
 * Kept as a non-async client component, and mounted as a plain child of the
 * dashboard layout, because awaiting anything at that level makes the whole
 * segment dynamic and kills `<Link>` prefetching for every sidebar route. See
 * the comment in `app/(dashboard)/layout.tsx`.
 *
 * @module components/feedback/feedback-launcher
 */

/** True when the browser-readable shadow flag is set. */
function isShadowing(): boolean {
  return document.cookie.split('; ').some((cookie) => cookie === 'zebri_is_shadowing=1');
}

/**
 * The cookie only changes on entering or leaving shadow mode, both of which
 * navigate, so there is nothing to subscribe to. `useSyncExternalStore` is
 * still the right tool: it gives the server a defined snapshot (`false`)
 * instead of a hydration mismatch, without a setState in an effect.
 */
const noSubscription = () => () => {};

/** Renders the pill unless an admin is viewing the app as someone else. */
export function FeedbackLauncher() {
  const [open, setOpen] = useState(false);
  const shadowing = useSyncExternalStore(noSubscription, isShadowing, () => false);

  // Filing while shadowing would produce a ticket that looks like the MC
  // raised it. The API rejects it too; this just keeps the button honest.
  if (shadowing) return null;

  return (
    <>
      {/* Hidden while the feedback modal is open: the pill clears the overlay
          ladder so it stays clickable over other modals, which would otherwise
          leave it floating on top of its own form. */}
      {!open && <FeedbackPill onClick={() => setOpen(true)} />}
      <FeedbackModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}

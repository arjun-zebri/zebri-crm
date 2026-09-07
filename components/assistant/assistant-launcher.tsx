'use client';

/**
 * Mounts the one corner control and everything behind it.
 *
 * Replaces `FeedbackLauncher`. Kept as a non-async client component,
 * and mounted as a plain child of the dashboard layout, because
 * awaiting anything at that level makes the whole segment dynamic and
 * kills `<Link>` prefetching for every sidebar route. See the comment
 * in `app/(dashboard)/layout.tsx`.
 *
 * @module components/assistant/assistant-launcher
 */

import { useState, useSyncExternalStore } from 'react';

import { FeedbackModal } from '@/components/feedback/feedback-modal';

import { useAssistant } from './assistant-context';
import { AssistantDock } from './assistant-dock';
import { AssistantPanel } from './assistant-panel';

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

/** The corner control, unless an admin is viewing the app as someone else. */
export function AssistantLauncher() {
  const assistant = useAssistant();
  const [menuOpen, setMenuOpen] = useState(false);
  const shadowing = useSyncExternalStore(noSubscription, isShadowing, () => false);

  // Filing while shadowing would produce a ticket that looks like the MC
  // raised it. The API rejects it too; this just keeps the button honest.
  if (shadowing || !assistant) return null;

  const { open, setOpen, hasChat, feedbackOpen, setFeedbackOpen } = assistant;

  return (
    <>
      {/* Hidden while the feedback form is open, so it never floats over
          its own modal, and because the pill this replaced did the same. */}
      {!feedbackOpen && (
        <AssistantDock
          menuOpen={menuOpen}
          onToggleMenu={() => {
            const next = !menuOpen;
            setMenuOpen(next);
            // Folding the menu takes the chat with it. Leaving a panel
            // floating with nothing under it to explain where it came
            // from is how a corner widget starts feeling haunted.
            if (!next) setOpen(false);
          }}
          chatOpen={open}
          onToggleChat={() => setOpen(!open)}
          onFeedback={() => {
            setMenuOpen(false);
            assistant.openFeedback();
          }}
          hasChat={hasChat}
        />
      )}

      {!feedbackOpen && <AssistantPanel />}

      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}

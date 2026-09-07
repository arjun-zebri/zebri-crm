'use client';

/**
 * The corner dock: one round button, two actions behind it.
 *
 * Pressing the round button reveals "Send feedback" and "Zebri AI" to
 * its left. Beside it rather than stacked above, because the panel opens
 * upward from here and a column of buttons in the same place would have
 * the chat and its own launchers fighting for one strip of screen.
 *
 * They fade in together, in place. They used to slide in from the right
 * and stagger, which made a two-button menu into a small performance:
 * the eye tracked the movement instead of reading the labels, and the
 * second button arriving late meant the pair were never both readable
 * until the animation had finished.
 *
 * The chat is behind the AI button specifically, not behind the round
 * one. The round button is a menu; opening a conversation is a choice
 * made inside it, which is what lets one control serve a page with a
 * copilot and a page without.
 *
 * "Zebri AI" is disabled where no page has offered a chat, rather than
 * hidden. A control that comes and goes between screens teaches nobody
 * where it lives; one that is visibly unavailable does.
 *
 * `z-[150]` clears the whole overlay ladder (`top` panels sit at
 * `z-[130]`) and stays under toasts at `z-[200]`: the dock has to stay
 * reachable with a modal open, since a modal is exactly where a bug
 * tends to show itself.
 *
 * Open, it occupies most of the bottom edge, so anything else anchored
 * there has to be moved clear. Three surfaces already were, back when
 * this was the Feedback pill: the toast stack
 * (`components/ui/toast`, offset up to `bottom-20`), the payments
 * footer total (`pr-40`) and the branding canvas zoom widget
 * (`right-40`). Add to that list rather than nudging the dock.
 *
 * @module components/assistant/assistant-dock
 */

import { Flag, Sparkles, WandSparkles, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

export interface AssistantDockProps {
  /** Are the two buttons showing? */
  menuOpen: boolean;
  onToggleMenu: () => void;
  /** Is the chat panel showing? Reflected on the AI button. */
  chatOpen: boolean;
  onToggleChat: () => void;
  onFeedback: () => void;
  /** False on a page that offers no chat; the AI button greys out. */
  hasChat: boolean;
}

/** Renders the dock. See {@link AssistantDockProps}. */
export function AssistantDock({
  menuOpen,
  onToggleMenu,
  chatOpen,
  onToggleChat,
  onFeedback,
  hasChat,
}: AssistantDockProps) {
  return (
    <div
      // Kept out of any screenshot the feedback form itself captures.
      data-capture-hide
      className="fixed bottom-6 right-6 z-[150] flex items-center gap-2"
    >
      {/* Both stay mounted, so the row never reflows and nothing jumps
          as they arrive. */}
      <DockButton show={menuOpen}>
        <Button shape="pill" variant="outline" onClick={onFeedback} className="shadow-lg">
          <Flag size={14} strokeWidth={1.5} />
          Send feedback
        </Button>
      </DockButton>

      <DockButton show={menuOpen}>
        <Button
          shape="pill"
          variant="outline"
          onClick={onToggleChat}
          disabled={!hasChat}
          aria-expanded={chatOpen}
          className="shadow-lg"
          title={hasChat ? 'Ask Zebri AI' : 'Zebri AI works on the workflow builder'}
        >
          <Sparkles size={14} strokeWidth={1.5} />
          Zebri AI
        </Button>
      </DockButton>

      <button
        type="button"
        onClick={onToggleMenu}
        aria-label={menuOpen ? 'Close Zebri menu' : 'Open Zebri menu'}
        aria-expanded={menuOpen}
        className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-brand-fg text-text-inverse shadow-lg transition hover:opacity-90"
      >
        {menuOpen ? (
          <X size={18} strokeWidth={1.5} />
        ) : (
          <WandSparkles size={18} strokeWidth={1.5} />
        )}
      </button>
    </div>
  );
}

/**
 * One button of the pair. Fades, and does not move.
 *
 * `pointer-events-none` while hidden matters as much as the opacity: a
 * fully transparent button still takes the click meant for the canvas
 * underneath it.
 */
function DockButton({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`transition-opacity duration-150 ease-out ${
        show ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      {children}
    </span>
  );
}

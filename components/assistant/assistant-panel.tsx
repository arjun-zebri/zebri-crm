'use client';

/**
 * The panel behind the corner button.
 *
 * It opens from the "Zebri AI" button in {@link AssistantDock} and
 * stacks above it, so the thing that opened it stays on screen and in
 * reach. The page fills the body through the portal slot.
 *
 * No feedback link in here. It had one while the round button opened
 * this panel directly; now that "Send feedback" is its own button in the
 * dock two inches below, a second copy inside the chat is the same
 * action offered twice in one corner.
 *
 * @module components/assistant/assistant-panel
 */

import { X } from 'lucide-react';

import { useAssistant } from './assistant-context';

/** The chat shell. Renders nothing unless the panel is open. */
export function AssistantPanel() {
  const assistant = useAssistant();
  if (!assistant?.open) return null;

  // Destructured rather than used through `assistant.x`: `setSlot` is
  // passed as a `ref` below, and the lint rule reads every other member
  // access on the same object as a ref read during render.
  const { setOpen, setSlot } = assistant;

  return (
    <div
      // Kept out of any screenshot the feedback form itself captures.
      data-capture-hide
      role="dialog"
      aria-label="Zebri AI"
      className="fixed bottom-20 right-6 z-[150] flex h-[520px] max-h-[70vh] w-[400px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-control border border-border-strong bg-card shadow-xl"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2">
        <span className="text-body font-medium text-text">Zebri AI</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="cursor-pointer rounded-control p-1 text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
          aria-label="Close"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      {/* The page's chat portals in here. Empty until it does. */}
      <div ref={setSlot} className="flex min-h-0 flex-1 flex-col" />
    </div>
  );
}

'use client';

/**
 * One corner control for Zebri AI and feedback.
 *
 * The two used to be separate floating things fighting for the same
 * corner: the Feedback pill on every page, and the workflow builder's
 * copilot stacked above it. Two controls, one of which appeared only on
 * one screen, both asking to be the thing you press when you want help.
 *
 * Now there is one button. What opens behind it depends on the page: a
 * chat where the page has one to offer, and the feedback form where it
 * does not. Either way the answer to "where do I go when I want
 * something from Zebri" is the same place.
 *
 * A page offers its chat by portalling into {@link AssistantSlot}
 * rather than by handing an element up through context. The page keeps
 * its own hooks, state and data fetching where they belong; the
 * launcher owns nothing but the shell.
 *
 * @module components/assistant/assistant-context
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface AssistantApi {
  /** Is the panel showing? */
  open: boolean;
  setOpen: (open: boolean) => void;
  /** The element a page's chat portals into. Null until the panel opens. */
  slot: HTMLElement | null;
  setSlot: (el: HTMLElement | null) => void;
  /** True while a page is offering a chat. */
  hasChat: boolean;
  /** A page calls this on mount and calls the returned function on unmount. */
  registerChat: () => () => void;
  /** Opens the feedback form, closing the panel behind it. */
  openFeedback: () => void;
  feedbackOpen: boolean;
  setFeedbackOpen: (open: boolean) => void;
}

const AssistantContext = createContext<AssistantApi | null>(null);

/** Wraps the dashboard so any page can offer its chat to the corner. */
export function AssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // A count rather than a boolean: a page unmounting must not clear a
  // registration a newly mounted one has just made, which is the order
  // React runs them in during a route change.
  const [chatCount, setChatCount] = useState(0);

  const registerChat = useCallback(() => {
    setChatCount((n) => n + 1);
    return () => setChatCount((n) => Math.max(0, n - 1));
  }, []);

  const openFeedback = useCallback(() => {
    setOpen(false);
    setFeedbackOpen(true);
  }, []);

  const value = useMemo<AssistantApi>(
    () => ({
      open,
      setOpen,
      slot,
      setSlot,
      hasChat: chatCount > 0,
      registerChat,
      openFeedback,
      feedbackOpen,
      setFeedbackOpen,
    }),
    [open, slot, chatCount, registerChat, openFeedback, feedbackOpen],
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

/**
 * The corner assistant.
 *
 * Returns null outside the provider so a component can be rendered in a
 * test, or on a public surface, without one.
 */
export function useAssistant(): AssistantApi | null {
  return useContext(AssistantContext);
}

/**
 * Zebri AI on the workflow builder, rendered into the corner assistant.
 *
 * The panel, its position and its close button belong to
 * `components/assistant`; this contributes the two things only the
 * builder can know, the conversation and the composer, and portals them
 * into the slot the panel exposes.
 *
 * That split is why this file lost most of what it used to carry. It
 * was a floating bar with its own transcript card, its own outside-press
 * dismissal and its own minimise button, stacked above the Feedback pill
 * in the same corner: two controls, both asking to be the thing you
 * press when you want help. There is one now, and the shell is not this
 * component's problem.
 *
 * @module app/(dashboard)/workflows/[id]/ai-copilot-bar
 */
'use client';

import { ArrowUp, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useAssistant } from '@/components/assistant/assistant-context';
import type { AutomationStatus } from '@/types/automations';

import { CopilotConversation } from './copilot-conversation';
import { useCopilotChat } from './use-copilot-chat';

interface Props {
  templateId: string;
  automationStatus: AutomationStatus;
  /** Refetch the automation + actions after the copilot mutates them. */
  onWorkflowChanged: () => void;
  /**
   * A description to send the moment the canvas opens, from the "describe
   * your process" entry on the empty library. Fires exactly once: the MC
   * typed it on the previous screen and should not have to type it again,
   * and should not have it re-sent on every re-render either.
   */
  openingPrompt?: string | undefined;
}

export function AiCopilotBar({
  templateId,
  automationStatus,
  onWorkflowChanged,
  openingPrompt,
}: Props) {
  const assistant = useAssistant();
  const [draft, setDraft] = useState('');
  const { entries, busy, capped, activity, send } = useCopilotChat({
    templateId,
    onWorkflowChanged,
  });

  // Tell the corner control there is a chat here, so its button opens
  // this rather than going straight to the feedback form.
  const register = assistant?.registerChat;
  useEffect(() => register?.(), [register]);

  const openingSentRef = useRef(false);
  const setOpen = assistant?.setOpen;
  useEffect(() => {
    if (!openingPrompt || openingSentRef.current) return;
    openingSentRef.current = true;
    // Opened for the MC: they asked for this on the previous screen, so
    // the answer arriving behind a closed panel would be a reply nobody
    // sees.
    setOpen?.(true);
    void send(openingPrompt);
  }, [openingPrompt, send, setOpen]);

  function submit() {
    if (!draft.trim() || busy || capped) return;
    void send(draft);
    setDraft('');
  }

  const slot = assistant?.slot;
  if (!slot) return null;

  return createPortal(
    <>
      <CopilotConversation
        entries={entries}
        busy={busy}
        activity={activity}
        draftOnly={automationStatus !== 'draft'}
      />

      <div className="shrink-0 border-t border-border px-3 py-2">
        {capped ? (
          <p className="py-1 text-body text-text-muted">
            This conversation is full. Reload the page to start a new one.
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <Sparkles size={16} strokeWidth={1.5} className="shrink-0 text-brand-fg" />
            {/* One row, always. It used to grow on focus, which moved
                the panel's top edge on every focus change and made the
                controls above it a moving target. */}
            <textarea
              value={draft}
              rows={1}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask Zebri to build a step"
              className="h-8 min-w-0 flex-1 resize-none bg-transparent py-1.5 text-body text-text placeholder:text-text-subtle focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim() || busy}
              className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-control bg-brand-fg text-text-inverse transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send"
            >
              <ArrowUp size={14} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
    </>,
    slot,
  );
}

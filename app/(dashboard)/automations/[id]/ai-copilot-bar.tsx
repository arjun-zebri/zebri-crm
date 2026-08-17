/**
 * Zebri AI, as a bar across the bottom of the builder.
 *
 * The copilot used to own a 380px left rail, which cost the flow a
 * third of the width to hold an empty conversation most of the time.
 * As a bar it stays one keystroke away and costs one row.
 *
 * The transcript is a fixed-height card floating just above the
 * composer, and it appears the way a modal does: a fade and a small
 * rise, with no height animation anywhere. Everything about this panel
 * that felt wrong came from animating height. The panel is anchored to
 * the bottom of the screen, so growing it moved its top edge, which
 * (a) slid the minimise button out from under the cursor between
 * mousedown and mouseup, and (b) shrank the scroll container's maximum
 * offset every frame, so the browser clamped the scroll position down
 * as the box opened: two movements in opposite directions at once.
 * Nothing here changes size now, so none of that can happen.
 *
 * @module app/(dashboard)/automations/[id]/ai-copilot-bar
 */
'use client'

import { ArrowUp, ChevronDown, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { AutomationStatus } from '@/types/automations'

import { CopilotConversation } from './copilot-conversation'
import { useCopilotChat } from './use-copilot-chat'

interface Props {
  automationId: string
  automationStatus: AutomationStatus
  /** Refetch the automation + actions after the copilot mutates them. */
  onWorkflowChanged: () => void
}

export function AiCopilotBar({ automationId, automationStatus, onWorkflowChanged }: Props) {
  const [draft, setDraft] = useState('')
  const [transcriptOpen, setTranscriptOpen] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)
  const { entries, busy, capped, activity, send } = useCopilotChat({
    automationId,
    onWorkflowChanged,
  })

  const hasConversation = entries.length > 0
  const showTranscript = hasConversation && transcriptOpen

  // Fold the transcript away on any press outside the panel. Bound on
  // mousedown rather than click so it closes on the same gesture that
  // starts an interaction with the canvas underneath, and in the
  // capture phase because the React Flow pane stops mousedown
  // propagation for panning: a bubble-phase listener never sees a
  // press that lands on the canvas, which is most of them.
  useEffect(() => {
    if (!showTranscript) return
    function onPressOutside(e: MouseEvent) {
      if (panelRef.current?.contains(e.target as Node)) return
      setTranscriptOpen(false)
    }
    document.addEventListener('mousedown', onPressOutside, true)
    return () => document.removeEventListener('mousedown', onPressOutside, true)
  }, [showTranscript])

  function submit() {
    if (!draft.trim() || busy || capped) return
    void send(draft)
    setDraft('')
    setTranscriptOpen(true)
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-6 pb-6">
      <div ref={panelRef} className="pointer-events-auto relative w-full max-w-[560px]">
        {/* Fixed height, so the card is the same size on the first turn
            and the fiftieth, and its scroll offset is never disturbed by
            the container resizing under it. The `max-h` is a guard for
            short viewports only: it tracks the window, never the
            content, so the card still never resizes as turns arrive. */}
        <div
          aria-hidden={!showTranscript}
          className={`absolute inset-x-0 bottom-full mb-2 flex h-[460px] max-h-[60vh] flex-col overflow-hidden rounded-control border border-border-strong bg-card shadow-xl transition-[opacity,transform] duration-200 ease-out ${
            showTranscript
              ? 'translate-y-0 opacity-100'
              : 'pointer-events-none translate-y-2 opacity-0'
          }`}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2">
            <span className="text-body font-medium text-text">Zebri AI</span>
            {/* Minimise, not close, and the only control here: the
                conversation lives for the life of the page, so folding
                the panel away never loses it and a reload is the way to
                start over. */}
            <button
              type="button"
              onClick={() => setTranscriptOpen(false)}
              className="cursor-pointer rounded-control p-1 text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
              aria-label="Minimise conversation"
              title="Minimise"
            >
              <ChevronDown size={16} strokeWidth={1.5} />
            </button>
          </div>
          <CopilotConversation
            entries={entries}
            busy={busy}
            activity={activity}
            draftOnly={automationStatus !== 'draft'}
          />
        </div>

        <div className="overflow-hidden rounded-control border border-border bg-card shadow-lg transition-colors duration-200 focus-within:border-border-strong">
          {capped ? (
            <div className="px-4 py-3 text-body text-text-muted">
              This conversation is full. Reload the page to start a new one.
            </div>
          ) : (
            <div className="flex items-center gap-3 px-3 py-2">
              <Sparkles size={16} strokeWidth={1.5} className="shrink-0 text-brand-fg" />
              {/* One row, always. It used to grow on focus, which moved
                  the panel's top edge on every focus change and made the
                  controls above it a moving target. */}
              <textarea
                value={draft}
                rows={1}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={() => setTranscriptOpen(true)}
                placeholder="Ask Zebri to build a step or the entire automation"
                className="h-8 min-w-0 flex-1 resize-none bg-transparent py-1.5 text-body text-text placeholder:text-text-subtle focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    submit()
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
      </div>
    </div>
  )
}

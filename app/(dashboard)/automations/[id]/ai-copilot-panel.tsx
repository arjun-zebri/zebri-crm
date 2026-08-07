/**
 * Zebri AI panel - left rail of the canvas builder.
 *
 * **Placeholder.** Single welcome message in the conversation; the
 * input does nothing when submitted. Wires into a real LLM in a
 * later phase.
 *
 * Opens / closes via a CSS width + opacity transition so the
 * canvas reshapes smoothly. Typing-only - no microphone.
 *
 * @module app/(dashboard)/automations/[id]/ai-copilot-panel
 */
'use client'

import { ArrowUp, Settings2, Sparkles, X } from 'lucide-react'
import { useState } from 'react'

interface Props {
  open: boolean
  onClose: () => void
}

const PANEL_WIDTH = 320

export function AiCopilotPanel({ open, onClose }: Props) {
  const [draft, setDraft] = useState('')

  return (
    <div
      style={{ width: open ? PANEL_WIDTH : 0 }}
      className="shrink-0 overflow-hidden transition-[width] duration-300 ease-out"
      aria-hidden={!open}
    >
      <div
        style={{ width: PANEL_WIDTH }}
        className={`h-full border-r border-border bg-surface flex flex-col transition-opacity duration-200 ${
          open ? 'opacity-100 delay-100' : 'opacity-0'
        }`}
      >
        <Header onClose={onClose} />
        <Conversation />
        <Composer
          value={draft}
          onChange={setDraft}
          onSubmit={() => {
            /* placeholder - not wired */
          }}
        />
      </div>
    </div>
  )
}

/* ─── Header ─────────────────────────────────────────────────── */

function Header({ onClose }: { onClose: () => void }) {
  return (
    <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-control bg-brand/10">
          <Sparkles size={14} strokeWidth={1.5} className="text-brand" />
        </span>
        <span className="text-body font-semibold">Zebri AI</span>
      </div>
      <div className="flex items-center gap-1 text-text-muted">
        <button
          type="button"
          className="p-1 rounded-control hover:bg-surface-muted hover:text-text cursor-pointer transition"
          aria-label="Zebri AI settings"
        >
          <Settings2 size={14} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-control hover:bg-surface-muted hover:text-text cursor-pointer transition"
          aria-label="Close Zebri AI"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}

/* ─── Conversation (single placeholder bubble) ───────────────── */

function Conversation() {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <AssistantBubble>
        I can help you build automations for your couples, fix errors, and
        suggest optimisations based on your tools and data.
      </AssistantBubble>
    </div>
  )
}

function AssistantBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface-muted rounded-control px-3 py-2 text-body text-text leading-relaxed">
      {children}
    </div>
  )
}

/* ─── Composer (typing only - no mic) ────────────────────────── */

function Composer({
  value,
  onChange,
  onSubmit,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
}) {
  return (
    <div className="border-t border-border p-3">
      <div className="rounded-control border border-border bg-surface-muted/40 flex items-end gap-2 pr-2 pb-2">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. When a couple accepts a quote, send a thank-you and create a contract task"
          rows={3}
          className="flex-1 bg-transparent text-body px-3 py-2 resize-none focus:outline-none placeholder:text-text-muted"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSubmit()
            }
          }}
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={!value.trim()}
          className="inline-flex items-center justify-center w-7 h-7 rounded-control bg-gray-900 text-white hover:bg-gray-700 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          aria-label="Send"
        >
          <ArrowUp size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
